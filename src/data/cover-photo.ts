import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Lets the parent take or choose a photo of a book's cover and returns it as a small JPEG data URI.
 * Covers are stored on the device with the rest of the bookshelf, so they are shrunk to about 20 KB.
 * Must be called straight from a button press: browsers block the file picker otherwise.
 */
export async function pickCoverPhoto(from: 'camera' | 'library'): Promise<string | undefined> {
  // iOS can only crop to a square, which would cut off a book cover, so only Android gets the crop step.
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: Platform.OS === 'android',
    aspect: [2, 3],
  };
  if (from === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return undefined;
  }
  const result =
    from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return undefined;

  const context = ImageManipulator.manipulate(result.assets[0].uri);
  context.resize({ width: 300 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
  return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : undefined;
}
