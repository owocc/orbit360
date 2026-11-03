package main

import (
	"os"
	"path/filepath"
	"testing"
)

// 真的下载一次 ffmpeg（macOS 走 evermeet.cx），验证解压与权限。
// 默认跳过，联网时用 ORBIT360_TEST_DOWNLOAD=1 跑：
//
//	HOME=/tmp/o360-home ORBIT360_TEST_DOWNLOAD=1 go test -run TestDownloadFFmpeg -v
func TestDownloadFFmpeg(t *testing.T) {
	if os.Getenv("ORBIT360_TEST_DOWNLOAD") == "" {
		t.Skip("设 ORBIT360_TEST_DOWNLOAD=1 才跑（会联网下载 ffmpeg）")
	}
	bin, err := fetchFFmpeg(func(f float64, note string) {})
	if err != nil {
		t.Fatalf("下载失败: %v", err)
	}
	for _, p := range []string{bin, ffprobeFor(bin)} {
		st, err := os.Stat(p)
		if err != nil {
			t.Fatalf("%s: %v", p, err)
		}
		if st.Mode().Perm()&0o111 == 0 {
			t.Fatalf("%s 不可执行: %v", p, st.Mode())
		}
	}
	if filepath.Dir(bin) != filepath.Join(configDir(), "bin") {
		t.Fatalf("下载到了意外位置: %s", bin)
	}
}
