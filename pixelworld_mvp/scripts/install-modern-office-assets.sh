#!/usr/bin/env bash
set -euo pipefail

zip_path="${1:-/home/a0665x/Downloads/Modern_Office_Revamped_v1.2.zip}"
project_dir="$(cd "$(dirname "$0")/.." && pwd -P)"
target_dir="$project_dir/public/assets/private/modern-office-v1.2"

if [[ ! -f "$zip_path" ]]; then
  echo "Modern Office archive not found: $zip_path" >&2
  exit 1
fi

archive_listing="$(unzip -Z1 "$zip_path")"
base_files=(LICENSE.txt Modern_Office_16x16.png 1_Room_Builder_Office/Room_Builder_Office_16x16.png)
for file in "${base_files[@]}"; do
  if ! grep -Fxq "$file" <<<"$archive_listing"; then
    echo "Required Modern Office file is missing: $file" >&2
    exit 1
  fi
done

if ! command -v convert >/dev/null 2>&1; then
  echo "ImageMagick convert is required to generate furniture geometry" >&2
  exit 1
fi

single_count="$(grep -Ec '^4_Modern_Office_singles/16x16/Modern_Office_Singles_[0-9]+\.png$' <<<"$archive_listing")"
if [[ "$single_count" -ne 339 ]]; then
  echo "Expected 339 Modern Office singles, found $single_count" >&2
  exit 1
fi

mkdir -p "$target_dir"
for file in "${base_files[@]}"; do
  unzip -joq "$zip_path" "$file" -d "$target_dir"
done
unzip -joq "$zip_path" '4_Modern_Office_singles/16x16/Modern_Office_Singles_*.png' -d "$target_dir"

catalog_path="$project_dir/src/rendering/modernOfficeCatalog.ts"
generated_file="$(mktemp)"
{
  printf '%s\n' "export type ModernOfficeCategory = 'surfaces' | 'seating-plants' | 'screens-electronics' | 'storage-partitions' | 'workstations';"
  printf '%s\n' 'export interface ModernOfficeCatalogItem {'
  printf '%s\n' '  id: number; key: string; path: string; category: ModernOfficeCategory; label: string;'
  printf '%s\n' '  opaqueBounds: { x: number; y: number; width: number; height: number };'
  printf '%s\n' '  footprint: { width: number; height: number }; visualOffset: { x: number; y: number };'
  printf '%s\n' '}'
  printf '%s\n' 'const ROOT = "/assets/private/modern-office-v1.2";'
  printf '%s\n' 'export const MODERN_OFFICE_CATALOG: readonly ModernOfficeCatalogItem[] = ['
  for id in $(seq 1 339); do
    image="$target_dir/Modern_Office_Singles_${id}.png"
    geometry="$(convert "$image" -channel A -threshold 0 -trim -format '%w %h %X %Y' info:)"
    if [[ ! "$geometry" =~ ^([0-9]+)[[:space:]]+([0-9]+)[[:space:]]+\+([0-9]+)[[:space:]]+\+([0-9]+)$ ]]; then
      echo "Could not read opaque bounds for single $id: $geometry" >&2
      exit 1
    fi
    width="${BASH_REMATCH[1]}"; height="${BASH_REMATCH[2]}"; x="${BASH_REMATCH[3]}"; y="${BASH_REMATCH[4]}"
    footprint_width="$(( (width + 15) / 16 ))"; footprint_height="$(( (height + 15) / 16 ))"
    (( footprint_width < 1 )) && footprint_width=1
    (( footprint_height < 1 )) && footprint_height=1
    if (( id <= 97 )); then category=surfaces
    elif (( id <= 120 )); then category=seating-plants
    elif (( id <= 178 )); then category=screens-electronics
    elif (( id <= 224 )); then category=storage-partitions
    else category=workstations
    fi
    offset_x="$(awk -v x="$x" -v w="$width" 'BEGIN { printf "%.1f", x + w / 2 - 16 }')"
    offset_y="$(awk -v y="$y" -v h="$height" 'BEGIN { printf "%.1f", y + h / 2 - 24 }')"
    printf '  { id: %d, key: "modern-office-v1.2-single-%d", path: `${ROOT}/Modern_Office_Singles_%d.png`, category: "%s", label: "Office %03d", opaqueBounds: { x: %d, y: %d, width: %d, height: %d }, footprint: { width: %d, height: %d }, visualOffset: { x: %s, y: %s } },\n' \
      "$id" "$id" "$id" "$category" "$id" "$x" "$y" "$width" "$height" "$footprint_width" "$footprint_height" "$offset_x" "$offset_y"
  done
  printf '%s\n' '];'
  printf '%s\n' 'export const catalogCategories = (): ModernOfficeCategory[] => ["surfaces", "seating-plants", "screens-electronics", "storage-partitions", "workstations"];'
  printf '%s\n' 'export const catalogItem = (id: number): ModernOfficeCatalogItem | undefined => MODERN_OFFICE_CATALOG.find((item) => item.id === id);'
  printf '%s\n' 'export function allCatalogPages(category: ModernOfficeCategory, pageSize = 24): Array<{ page: number; totalPages: number; items: readonly ModernOfficeCatalogItem[] }> {'
  printf '%s\n' '  const matching = MODERN_OFFICE_CATALOG.filter((item) => item.category === category);'
  printf '%s\n' '  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));'
  printf '%s\n' '  return Array.from({ length: totalPages }, (_, page) => ({ page, totalPages, items: matching.slice(page * pageSize, (page + 1) * pageSize) }));'
  printf '%s\n' '}'
  printf '%s\n' 'export function catalogPage(category: ModernOfficeCategory, page: number, pageSize = 24) {'
  printf '%s\n' '  const pages = allCatalogPages(category, pageSize); return pages[Math.max(0, Math.min(pages.length - 1, page))]!;'
  printf '%s\n' '}'
} >"$generated_file"
mv "$generated_file" "$catalog_path"

echo "Installed 339 licensed Modern Office singles into $target_dir"
