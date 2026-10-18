import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** Browsers only expose the camera on HTTPS or localhost. */
const insecureWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext;

/** Full-screen camera that reads a book's EAN-13 barcode (ISBN-13) and hands it back once. Mount it only while scanning. */
export function IsbnScanner({ onScanned, onClose }: {
  onScanned: (isbn: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  // The camera fires many events per second; only take the first book barcode.
  const done = useRef(false);

  function onBarcodeScanned({ data }: BarcodeScanningResult) {
    if (done.current || !/^97[89]\d{10}$/.test(data)) return;
    done.current = true;
    onScanned(data);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">掃描 ISBN 條碼</ThemedText>
          {insecureWeb ? (
            <Message text="瀏覽器只允許 HTTPS 網址使用相機。請改用 HTTPS 網址開啟，或手動輸入 ISBN。" />
          ) : !permission ? null : !permission.granted ? (
            <View style={styles.message}>
              <ThemedText type="small">需要相機權限才能掃描書背的條碼。</ThemedText>
              {permission.canAskAgain ? (
                <Button title="允許使用相機" onPress={requestPermission} />
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  請到手機的「設定」打開這個 app 的相機權限。
                </ThemedText>
              )}
            </View>
          ) : (
            <View style={styles.cameraBox}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
                onBarcodeScanned={onBarcodeScanned}
              />
              <View style={styles.frame} pointerEvents="none" />
            </View>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            對準書背上以 978 或 979 開頭的條碼。
          </ThemedText>
          <Button title="取消" onPress={onClose} />
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

function Message({ text }: { text: string }) {
  return (
    <View style={styles.message}>
      <ThemedText type="small">{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three },
  cameraBox: {
    flex: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '80%',
    height: 120,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: Spacing.two,
  },
  message: { flex: 1, justifyContent: 'center', gap: Spacing.three },
});
