package main

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// scoop 的 shim 被脚本覆盖时，resolveExecutable 应改用它 .shim 指向的真实 PE。
func TestResolveScoopShim(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("只验证 Windows 的 shim / PE")
	}
	dir := t.TempDir()
	shim := filepath.Join(dir, "ffmpeg.exe")
	if err := os.WriteFile(shim, []byte("#!/usr/bin/env python3\nprint('broken shim')\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(dir, "apps", "ffmpeg", "current", "bin", "ffmpeg.exe")
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, []byte("MZfake-pe"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "ffmpeg.shim"), []byte("path = \""+target+"\"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := resolveExecutable(shim); got != target {
		t.Fatalf("resolveExecutable(%q) = %q，想要 %q", shim, got, target)
	}
	if !executableOK(shim) {
		t.Fatal("可解析的 shim 应判为可用")
	}
	if executableOK(filepath.Join(dir, "missing.exe")) {
		t.Fatal("不存在的路径不应可用")
	}
}

// Windows 的 PATH 常见写法是 "Path="，withPath 也要能识别。
func TestWithPathCaseInsensitive(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("Windows 环境变量名大小写不敏感")
	}
	sep := string(os.PathListSeparator)
	got := withPath([]string{"HOME=/x", "Path=/a:/b"}, `C:\bin`)
	if len(got) != 2 || got[1] != "PATH="+`C:\bin`+sep+"/a:/b" {
		t.Fatalf("withPath: %v", got)
	}
}
