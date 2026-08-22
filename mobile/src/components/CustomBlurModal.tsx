// @ts-nocheck
import React, { useEffect } from 'react';
import { Modal, View, Platform, StyleSheet, BackHandler } from 'react-native';

interface CustomBlurModalProps {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
}

export default function CustomBlurModal({
  visible,
  onRequestClose,
  children,
  transparent = true,
  animationType = 'slide',
}: CustomBlurModalProps) {
  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) return;

    const backAction = () => {
      if (onRequestClose) {
        onRequestClose();
        return true; // Block default navigation back action
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [visible, onRequestClose]);

  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType={animationType}
      onRequestClose={onRequestClose}
    >
      {children}
    </Modal>
  );
}

const styles = StyleSheet.create({
  androidModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    elevation: 10,
  },
});
