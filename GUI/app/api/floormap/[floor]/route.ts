// フロア占有格子地図のメタデータ配信 (map_server 形式 yaml のパース結果)。
// GUI サーバ (RPi5) 上の environment リポジトリから直接読むことで、
// /map トピックの無線転送 (フロア切替時の帯域スパイク) を回避する。
// 環境変数 GUI_MAP_DIR に occupancy ディレクトリを指定 (例: ~/environment_bld10/occupancy)。

import { NextResponse } from "next/server";
import { floorMapMeta, mapDir } from "@/lib/mapServer";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ floor: string }> },
) {
  const { floor } = await params;
  if (!/^\d{1,2}$/.test(floor)) {
    return NextResponse.json({ error: "bad floor" }, { status: 400 });
  }
  if (!mapDir()) {
    return NextResponse.json(
      { error: "GUI_MAP_DIR not configured" },
      { status: 404 },
    );
  }
  const meta = await floorMapMeta(floor);
  if (!meta) {
    return NextResponse.json(
      { error: `no map for floor ${floor}` },
      { status: 404 },
    );
  }
  return NextResponse.json(meta);
}
