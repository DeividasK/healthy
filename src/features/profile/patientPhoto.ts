import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { Attachment, Patient } from 'fhir/r5';

// Small enough to keep the Patient resource light when it syncs and exports.
const PHOTO_SIZE = 256;

/**
 * Returns an image URI for a FHIR photo attachment stored inline.
 */
export function getPhotoUri(photo?: Attachment | null): string | undefined {
  if (!photo?.data) return undefined;
  return `data:${photo.contentType || 'image/jpeg'};base64,${photo.data}`;
}

/**
 * Returns the first inline photo of a FHIR Patient as an image URI.
 */
export function getPatientPhotoUri(
  patient?: Patient | null
): string | undefined {
  return getPhotoUri(patient?.photo?.find((photo) => photo.data));
}

/**
 * Lets the user pick an image and returns it as a square JPEG attachment,
 * or null when they cancel.
 */
export async function pickPatientPhoto(): Promise<Attachment | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  // The web picker has no crop step, so centre-crop to a square here.
  const side = Math.min(asset.width, asset.height);
  if (side > 0 && asset.width !== asset.height) {
    context.crop({
      originX: Math.floor((asset.width - side) / 2),
      originY: Math.floor((asset.height - side) / 2),
      width: side,
      height: side,
    });
  }
  const size = side > 0 ? Math.min(side, PHOTO_SIZE) : PHOTO_SIZE;
  context.resize({ width: size, height: size });
  const image = await context.renderAsync();
  try {
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.8,
      base64: true,
    });
    if (!saved.base64) return null;
    return {
      contentType: 'image/jpeg',
      data: saved.base64,
      width: saved.width,
      height: saved.height,
    };
  } finally {
    image.release();
    context.release();
  }
}
