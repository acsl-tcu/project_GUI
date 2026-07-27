// フロア地図の画像本体 (PGM/PNG) 配信。next start の gzip 圧縮が効くため
// 白領域の多い PGM は実転送量が大きく圧縮される。

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { gzipSync } from "zlib";
import { floorMapMeta, mapDir } from "@/lib/mapServer";

// PGM は next start の自動圧縮対象外 (octet-stream) なので自前で gzip する。
// 白領域が多く 30MB → 数百 KB 程度になる。ファイル更新時刻をキーにキャッシュ。
const gzCache = new Map<string, { mtimeMs: number; gz: Buffer }>();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ floor: string }> },
) {
  const { floor } = await params;
  if (!/^\d{1,2}$/.test(floor)) {
    return NextResponse.json({ error: "bad floor" }, { status: 400 });
  }
  const dir = mapDir();
  if (!dir) {
    return NextResponse.json(
      { error: "GUI_MAP_DIR not configured" },
      { status: 404 },
    );
  }
  const meta = await floorMapMeta(floor);
  if (!meta) {
    return NextResponse.json({ error: "no map yaml" }, { status: 404 });
  }
  const imgPath = path.join(dir, meta.image);
  let buf: Buffer;
  let mtimeMs = 0;
  try {
    mtimeMs = (await fs.stat(imgPath)).mtimeMs;
    buf = await fs.readFile(imgPath);
  } catch {
    return NextResponse.json(
      { error: `image not found: ${meta.image}` },
      { status: 404 },
    );
  }
  const type = meta.image.endsWith(".png")
    ? "image/png"
    : "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "X-Map-Image": meta.image,
    "Cache-Control": "public, max-age=300",
  };

  // PNG は圧縮済みなので素通し。PGM は gzip 対応クライアントに圧縮して返す
  const acceptGzip = (req.headers.get("accept-encoding") ?? "").includes("gzip");
  if (!meta.image.endsWith(".png") && acceptGzip) {
    let entry = gzCache.get(imgPath);
    if (!entry || entry.mtimeMs !== mtimeMs) {
      entry = { mtimeMs, gz: gzipSync(buf) };
      gzCache.set(imgPath, entry);
      if (gzCache.size > 12) {
        const first = gzCache.keys().next().value;
        if (first) gzCache.delete(first);
      }
    }
    headers["Content-Encoding"] = "gzip";
    return new NextResponse(new Uint8Array(entry.gz), { headers });
  }
  return new NextResponse(new Uint8Array(buf), { headers });
}
