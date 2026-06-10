package utils

import (
	"bufio"
	"os"
)

func ReadFromStdin() []string {
	var urls []string
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Split(bufio.ScanLines)

	for scanner.Scan() {
		urls = append(urls, scanner.Text())
	}
	return urls
}

func ReadFromFile(fileName string) []string {
	var fileContent []string
	file, err := os.Open(fileName)
	if err != nil {
		return nil
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fileContent = append(fileContent, scanner.Text())
	}
	return fileContent
}

func Contains(slice []string, elements string) bool {
	for _, s := range slice {
		if elements == s {
			return true
		}
	}
	return false
}

func Banner() string {
	return `
  ______          _   _             _____ _____  
 |  ____|        | | (_)           |_   _|  __ \ 
 | |__ ___  _ __ | |_ ___   _____    | | | |__) |
 |  __/ _ \| '__|| __| \ \ / / _ \   | | |  ___/ 
 | | | (_) | |   | |_| |\ V /  __/  _| |_| |     
 |_|  \___/|_|    \__|_| \_/ \___| |_____|_|     

                                @QASIM
_____________________________________________

`
}
