import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { firebaseConfig } from "../config/firebase";

export interface FirebasePhoneAuthBridgeRef {
  sendOtp: (phoneNumber: string) => Promise<string>;
  confirmOtp: (code: string) => Promise<string>;
}

const HTML_CONTENT = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #recaptcha-container {
      display: flex;
      justify-content: center;
      margin: 10px;
    }
    .status {
      font-size: 14px;
      color: #5E748B;
      text-align: center;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div id="recaptcha-container"></div>
  <div id="status" class="status">Initializing security verification...</div>

  <script>
    var config = ${JSON.stringify(firebaseConfig)};
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    var recaptchaVerifier = null;
    var confirmationResult = null;
    var isReady = false;

    function post(data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    function initVerifier() {
      try {
        if (recaptchaVerifier) {
          try { recaptchaVerifier.clear(); } catch(e) {}
        }
        recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
          size: 'invisible',
          callback: function(token) {
            post({ type: 'CAPTCHA_SOLVED', token: token });
          },
          'expired-callback': function() {
            post({ type: 'CAPTCHA_EXPIRED' });
          }
        });

        recaptchaVerifier.render().then(function() {
          isReady = true;
          document.getElementById('status').innerText = 'Ready';
          post({ type: 'READY' });
        }).catch(function(err) {
          post({ type: 'ERROR', code: err.code || 'init_error', message: err.message });
        });
      } catch(err) {
        post({ type: 'ERROR', code: 'init_error', message: err.message });
      }
    }

    window.sendOtp = function(phoneNumber) {
      document.getElementById('status').innerText = 'Sending SMS code to ' + phoneNumber + '...';
      if (!recaptchaVerifier) {
        initVerifier();
      }

      firebase.auth().signInWithPhoneNumber(phoneNumber, recaptchaVerifier)
        .then(function(result) {
          confirmationResult = result;
          document.getElementById('status').innerText = 'Code sent successfully';
          post({
            type: 'OTP_SENT',
            verificationId: result.verificationId
          });
        })
        .catch(function(err) {
          document.getElementById('status').innerText = 'Error: ' + (err.message || 'Failed to send OTP');
          try {
            if (recaptchaVerifier) {
              recaptchaVerifier.render().then(function(wId) { recaptchaVerifier.reset(wId); });
            }
          } catch(e) {}
          post({
            type: 'ERROR',
            code: err.code || 'auth/unknown',
            message: err.message || 'Failed to send OTP'
          });
        });
    };

    window.confirmOtp = function(code) {
      document.getElementById('status').innerText = 'Verifying code...';
      if (!confirmationResult) {
        post({
          type: 'ERROR',
          code: 'auth/session-expired',
          message: 'Session expired. Please request a new OTP.'
        });
        return;
      }

      confirmationResult.confirm(code)
        .then(function(userCredential) {
          return userCredential.user.getIdToken();
        })
        .then(function(idToken) {
          document.getElementById('status').innerText = 'Verified successfully';
          post({
            type: 'OTP_CONFIRMED',
            idToken: idToken
          });
        })
        .catch(function(err) {
          document.getElementById('status').innerText = 'Invalid code';
          post({
            type: 'ERROR',
            code: err.code || 'auth/invalid-verification-code',
            message: err.message || 'Invalid verification code'
          });
        });
    };

    initVerifier();
  </script>
</body>
</html>`;

export const FirebasePhoneAuthBridge = forwardRef<FirebasePhoneAuthBridgeRef, {}>(
  (_, ref) => {
    if (Platform.OS === "web") {
      return null;
    }

    const webViewRef = useRef<WebView>(null);
    const [isBridgeReady, setIsBridgeReady] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    const pendingSendPromise = useRef<{
      resolve: (id: string) => void;
      reject: (err: any) => void;
    } | null>(null);

    const pendingConfirmPromise = useRef<{
      resolve: (idToken: string) => void;
      reject: (err: any) => void;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      sendOtp: (phoneNumber: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          pendingSendPromise.current = { resolve, reject };

          const script = `window.sendOtp("${phoneNumber}"); true;`;
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(script);
          } else {
            reject(new Error("Phone verification bridge is not initialized"));
          }

          // Timeout safety: 30 seconds
          setTimeout(() => {
            if (pendingSendPromise.current) {
              pendingSendPromise.current.reject(new Error("SMS request timed out. Please try again."));
              pendingSendPromise.current = null;
              setModalVisible(false);
            }
          }, 30000);
        });
      },

      confirmOtp: (code: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          pendingConfirmPromise.current = { resolve, reject };

          const script = `window.confirmOtp("${code}"); true;`;
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(script);
          } else {
            reject(new Error("Phone verification bridge is not initialized"));
          }

          // Timeout safety: 20 seconds
          setTimeout(() => {
            if (pendingConfirmPromise.current) {
              pendingConfirmPromise.current.reject(new Error("OTP verification timed out. Please try again."));
              pendingConfirmPromise.current = null;
            }
          }, 20000);
        });
      },
    }));

    const handleMessage = (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "READY") {
          setIsBridgeReady(true);
        } else if (data.type === "OTP_SENT") {
          setModalVisible(false);
          if (pendingSendPromise.current) {
            pendingSendPromise.current.resolve(data.verificationId || "success");
            pendingSendPromise.current = null;
          }
        } else if (data.type === "OTP_CONFIRMED") {
          setModalVisible(false);
          if (pendingConfirmPromise.current) {
            pendingConfirmPromise.current.resolve(data.idToken);
            pendingConfirmPromise.current = null;
          }
        } else if (data.type === "ERROR") {
          setModalVisible(false);
          const err = new Error(data.message || "Authentication error");
          (err as any).code = data.code;

          if (pendingSendPromise.current) {
            pendingSendPromise.current.reject(err);
            pendingSendPromise.current = null;
          }
          if (pendingConfirmPromise.current) {
            pendingConfirmPromise.current.reject(err);
            pendingConfirmPromise.current = null;
          }
        }
      } catch (err) {
        console.warn("Phone auth bridge message parse error:", err);
      }
    };

    return (
      <>
        {/* Hidden background WebView for invisible reCAPTCHA and Firebase Auth */}
        <View style={styles.hiddenContainer} pointerEvents="none">
          <WebView
            ref={webViewRef}
            source={{
              html: HTML_CONTENT,
              baseUrl: `https://${firebaseConfig.authDomain}`,
            }}
            originWhitelist={["*"]}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mixedContentMode="always"
            onMessage={handleMessage}
            style={styles.hiddenWebView}
          />
        </View>

        {/* Modal only in the rare case that visual reCAPTCHA challenge is required */}
        {modalVisible && (
          <Modal transparent animationType="fade" visible={modalVisible}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Security Verification</Text>
                <Text style={styles.modalSubtitle}>Please complete the security check to proceed.</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setModalVisible(false);
                    if (pendingSendPromise.current) {
                      pendingSendPromise.current.reject(new Error("Security check cancelled."));
                      pendingSendPromise.current = null;
                    }
                  }}
                >
                  <Text style={styles.closeButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </>
    );
  }
);

FirebasePhoneAuthBridge.displayName = "FirebasePhoneAuthBridge";

const styles = StyleSheet.create({
  hiddenContainer: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0.01,
    top: -1000,
    left: -1000,
  },
  hiddenWebView: {
    width: 1,
    height: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0D3666",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#5E748B",
    textAlign: "center",
    marginBottom: 16,
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#F3F7FC",
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5E748B",
  },
});
