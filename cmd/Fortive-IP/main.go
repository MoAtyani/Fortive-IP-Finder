package main

import (
	"fmt"
	"os"

	"github.com/gammazero/workerpool"
	"github.com/musana/fortive-ip-finder/internal/config"
	"github.com/musana/fortive-ip-finder/internal/scanner"
	"github.com/musana/fortive-ip-finder/internal/utils"
	"github.com/musana/fortive-ip-finder/internal/api"
	"github.com/musana/fortive-ip-finder/web"
)

func main() {
	fmt.Print(utils.Banner())

	options := config.ParseOptions()

	if options.Serve {
		server := &api.Server{
			Options: options,
			DistFS:  web.GetFileSystem(),
		}
		if err := server.Start(); err != nil {
			fmt.Printf("Server failed: %v\n", err)
			os.Exit(1)
		}
		return
	}

	var urls []string
	var domainList []string

	if options.File != "" && options.DomainList == "" {
		urls = utils.ReadFromFile(options.File)
	} else if options.File == "" && options.DomainList != "" {
		urls = append(urls, options.TargetDomain)
		domainList = utils.ReadFromFile(options.DomainList)
	} else {
		fi, _ := os.Stdin.Stat()
		if fi.Mode()&os.ModeNamedPipe == 0 {
			fmt.Println("[!] No data found in pipe. Urls must be given using pipe or f parameter!")
			os.Exit(1)
		} else {
			urls = utils.ReadFromStdin()
		}
	}

	scanner := scanner.New(options, urls, domainList)
	scanner.PreScan()

	wp := workerpool.New(options.Worker)
	for _, url := range urls {
		url := url
		wp.Submit(func() {
			scanner.Start(url)
		})
	}
	wp.StopWait()
}
