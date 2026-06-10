package api

import (
	"encoding/json"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/gammazero/workerpool"
	"github.com/musana/fortive-ip-finder/internal/scanner"
	"github.com/musana/fortive-ip-finder/pkg/models"
	"gopkg.in/yaml.v2"
)

func init() {
	mime.AddExtensionType(".js", "application/javascript")
	mime.AddExtensionType(".css", "text/css")
	mime.AddExtensionType(".svg", "image/svg+xml")
}

type Server struct {
	Options *models.Options
	DistFS  http.FileSystem
}

type ScanRequest struct {
	Domains        []string `json:"domains"`
	Censys         bool     `json:"censys"`
	SecurityTrails bool     `json:"securitytrails"`
	Shodan         bool     `json:"shodan"`
	Zoomeye        bool     `json:"zoomeye"`
	JA3            string   `json:"ja3"`
	UserAgent      string   `json:"user_agent"`
}

func (s *Server) Start() error {
	mux := http.NewServeMux()

	// API Endpoints
	mux.HandleFunc("/api/scan", s.handleScan)
	mux.HandleFunc("/api/config", s.handleConfig)

	// Serve Static Files (Frontend)
	if s.DistFS != nil {
		mux.Handle("/", http.FileServer(s.DistFS))
	} else {
		// Fallback to serving from local disk if not embedded
		mux.Handle("/", http.FileServer(http.Dir("./web/dist")))
	}

	addr := fmt.Sprintf(":%d", s.Options.Port)
	fmt.Printf("[+] Starting web dashboard on http://localhost%s\n", addr)
	return http.ListenAndServe(addr, enableCORS(mux))
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
		if r.Method == "OPTIONS" {
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	var req ScanRequest
	// For SSE, we might receive params in URL if using EventSource, 
	// but let's assume we can also use fetch with POST and stream response.
	// Actually, standard SSE via EventSource only supports GET.
	// We'll use a custom fetch implementation on the frontend to support POST body with streaming text.
	
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	sendEvent := func(eventType, data string) {
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, data)
		flusher.Flush()
	}

	// Create custom options for this scan
	scanOpts := *s.Options
	scanOpts.Censys = req.Censys
	scanOpts.SecurityTrails = req.SecurityTrails
	scanOpts.Shodan = req.Shodan
	scanOpts.Zoomeye = req.Zoomeye
	
	if req.JA3 != "" {
		scanOpts.JA3 = req.JA3
	}
	if req.UserAgent != "" {
		scanOpts.UserAgent = req.UserAgent
	}

	sc := scanner.New(&scanOpts, req.Domains, nil)
	
	sc.OnResult = func(url, realIP, source, htmlTitle string) {
		result := map[string]string{
			"url": url,
			"ip": realIP,
			"source": source,
			"title": htmlTitle,
		}
		b, _ := json.Marshal(result)
		sendEvent("result", string(b))
	}

	sendEvent("status", "Starting pre-scan...")
	sc.PreScan()

	sendEvent("status", "Starting scan...")
	wp := workerpool.New(scanOpts.Worker)
	
	var wg sync.WaitGroup
	for _, url := range req.Domains {
		url := url
		wg.Add(1)
		wp.Submit(func() {
			defer wg.Done()
			sc.Start(url)
		})
	}

	wg.Wait()
	wp.StopWait()

	sendEvent("status", "Scan complete")
	sendEvent("done", "{}")
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	home := os.Getenv("HOME")
	if home == "" {
		home = os.Getenv("USERPROFILE")
	}
	configDir := filepath.Join(home, ".config")
	configPath := filepath.Join(configDir, "fortive-ip-finder.yaml")

	if r.Method == "GET" {
		f, err := os.ReadFile(configPath)
		if err != nil {
			// Try fallback to cf-hero.yaml
			fallbackPath := filepath.Join(configDir, "cf-hero.yaml")
			var fallbackErr error
			f, fallbackErr = os.ReadFile(fallbackPath)
			if fallbackErr != nil {
				// Return empty config
				json.NewEncoder(w).Encode(map[string][]string{})
				return
			}
		}

		var apiKeys map[string][]string
		yaml.Unmarshal(f, &apiKeys)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(apiKeys)
		return
	}

	if r.Method == "POST" {
		var apiKeys map[string][]string
		if err := json.NewDecoder(r.Body).Decode(&apiKeys); err != nil {
			http.Error(w, "Invalid payload", http.StatusBadRequest)
			return
		}

		os.MkdirAll(configDir, 0755)
		b, _ := yaml.Marshal(apiKeys)
		os.WriteFile(configPath, b, 0644)
		
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"success"}`))
		return
	}
}
