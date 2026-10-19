import { CameraView } from 'expo-camera';
import { StyleSheet } from 'react-native';

/** Live back-camera preview that reports every EAN-13 barcode it sees. */
export function IsbnCamera({ onBarcode }: { onBarcode: (data: string) => void }) {
  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
      onBarcodeScanned={({ data }) => onBarcode(data)}
    />
  );
}
