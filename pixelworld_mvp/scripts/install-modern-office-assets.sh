#!/usr/bin/env bash
set -euo pipefail

zip_path="${1:-/home/a0665x/Downloads/Modern_Office_Revamped_v1.2.zip}"
project_dir="$(cd "$(dirname "$0")/.." && pwd -P)"
target_dir="$project_dir/public/assets/private/modern-office-v1.2"

if [[ ! -f "$zip_path" ]]; then
  echo "Modern Office archive not found: $zip_path" >&2
  exit 1
fi

files=(
  LICENSE.txt
  Modern_Office_16x16.png
  1_Room_Builder_Office/Room_Builder_Office_16x16.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_98.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_101.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_129.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_171.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_173.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_175.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_176.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_177.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_193.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_200.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_207.png
  4_Modern_Office_singles/16x16/Modern_Office_Singles_225.png
)

archive_listing="$(unzip -Z1 "$zip_path")"
for file in "${files[@]}"; do
  if ! grep -Fxq "$file" <<<"$archive_listing"; then
    echo "Required Modern Office file is missing: $file" >&2
    exit 1
  fi
done

mkdir -p "$target_dir"
for file in "${files[@]}"; do
  unzip -joq "$zip_path" "$file" -d "$target_dir"
done

echo "Installed ${#files[@]} licensed Modern Office v1.2 files into $target_dir"
