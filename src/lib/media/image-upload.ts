export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const AVATAR_UPLOAD_MAX_MB = 5;
export const AVATAR_UPLOAD_MAX_BYTES = AVATAR_UPLOAD_MAX_MB * 1024 * 1024;

export const SCHOOL_LOGO_UPLOAD_MAX_MB = 2;
export const SCHOOL_LOGO_UPLOAD_MAX_BYTES = SCHOOL_LOGO_UPLOAD_MAX_MB * 1024 * 1024;

export function isAcceptedImageType(type: string) {
  return IMAGE_MIME_TYPES.some((acceptedType) => acceptedType === type);
}
