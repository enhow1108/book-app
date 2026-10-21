import { useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/form';
import { IsbnCamera } from '@/components/isbn-camera';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isBookBarcode, isIsbn13 } from '@/data/barcode';

/** Browsers only expose the camera on HTTPS or localhost. */
const insecureWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext;

/** How long a non-ISBN barcode waits in case an ISBN on the same cover shows up too. */
const OTHER_CODE_WAIT_MS = 800;

/**
 * Full-screen camera that reads a book's EAN-13 barcode and hands it back once. Mount it only while scanning.
 * ISBNs win; a book without one (such as a Japanese monthly picture book with a magazine code) gives its other barcode.
 */
export function IsbnScanner({ onScanned, onClose }: {
  onScanned: (isbn: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  // The camera fires many events per second; only take the first book barcode.
  const done = useRef(false);
  const waiting = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(waiting.current), []);

  function finish(code: string) {
    if (done.current) return;
    done.current = true;
    clearTimeout(waiting.current);
    onScanned(code);
  }

  function onBarcode(data: string) {
    // Some readers append a magazine's 5-digit add-on after the 13 digits.
    const code = data.replace(/\D/g, '').slice(0, 13);
    if (done.current || !isBookBarcode(code)) return;
    if (isIsbn13(code)) return finish(code);
    if (!waiting.current) waiting.current = setTimeout(() => finish(code), OTHER_CODE_WAIT_MS);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">掃描書的條碼</ThemedText>
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
              <IsbnCamera onBarcode={onBarcode} />
              <View style={styles.frame} pointerEvents="none" />
            </View>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            對準書背上以 978 或 979 開頭的 ISBN 條碼；沒有 ISBN 的日本月刊繪本可以掃雜誌條碼（491 開頭）。手機離書約 15–20 公分，畫面模糊時把書稍微拿遠一點。
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
