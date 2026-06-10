package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed dist/*
var distFS embed.FS

// GetFileSystem returns the embedded filesystem, rooted at dist/
func GetFileSystem() http.FileSystem {
	f, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}
	return http.FS(f)
}
