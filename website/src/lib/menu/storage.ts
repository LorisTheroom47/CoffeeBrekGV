export const MENU_IMAGES_BUCKET = "menu-images";
export const MENU_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

const uuidPattern =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const managedImagePathPattern = new RegExp(
  `^menu-items/${uuidPattern}/${uuidPattern}\\.(?:jpg|png|webp)$`,
  "i",
);

export function isManagedMenuImagePath(value: string | null): value is string {
  return Boolean(value && managedImagePathPattern.test(value));
}

export function getMenuImagePublicUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

  if (!supabaseUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const imageUrl = new URL(value);
      const projectUrl = new URL(supabaseUrl);
      const expectedPath = `/storage/v1/object/public/${MENU_IMAGES_BUCKET}/`;

      return imageUrl.origin === projectUrl.origin &&
        imageUrl.pathname.startsWith(expectedPath)
        ? imageUrl.toString()
        : null;
    } catch {
      return null;
    }
  }

  if (!isManagedMenuImagePath(value)) {
    return null;
  }

  const encodedPath = value.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${MENU_IMAGES_BUCKET}/${encodedPath}`;
}
