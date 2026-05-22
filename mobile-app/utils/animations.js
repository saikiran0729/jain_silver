import { Animated, Easing } from 'react-native';

/**
 * Animation utilities for smooth, professional transitions
 * Inspired by GIVA's elegant animations
 */

// Fade in animation
export const fadeIn = (value, duration = 300, delay = 0) => {
  return Animated.timing(value, {
    toValue: 1,
    duration,
    delay,
    easing: Easing.out(Easing.ease),
    useNativeDriver: true,
  });
};

// Fade out animation
export const fadeOut = (value, duration = 200) => {
  return Animated.timing(value, {
    toValue: 0,
    duration,
    easing: Easing.in(Easing.ease),
    useNativeDriver: true,
  });
};

// Slide up animation
export const slideUp = (value, distance = 50, duration = 400, delay = 0) => {
  return Animated.timing(value, {
    toValue: 0,
    duration,
    delay,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  });
};

// Slide down animation
export const slideDown = (value, distance = 50, duration = 300) => {
  return Animated.timing(value, {
    toValue: distance,
    duration,
    easing: Easing.in(Easing.cubic),
    useNativeDriver: true,
  });
};

// Scale animation (for buttons, cards)
export const scaleIn = (value, duration = 300, delay = 0) => {
  return Animated.timing(value, {
    toValue: 1,
    duration,
    delay,
    easing: Easing.out(Easing.back(1.2)),
    useNativeDriver: true,
  });
};

// Scale out animation
export const scaleOut = (value, duration = 200) => {
  return Animated.timing(value, {
    toValue: 0,
    duration,
    easing: Easing.in(Easing.back(1.2)),
    useNativeDriver: true,
  });
};

// Pulse animation (for loading, highlights)
export const pulse = (value, min = 0.8, max = 1) => {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: max,
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: min,
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ])
  );
};

// Shake animation (for errors)
export const shake = (value) => {
  return Animated.sequence([
    Animated.timing(value, {
      toValue: -10,
      duration: 50,
      useNativeDriver: true,
    }),
    Animated.timing(value, {
      toValue: 10,
      duration: 50,
      useNativeDriver: true,
    }),
    Animated.timing(value, {
      toValue: -10,
      duration: 50,
      useNativeDriver: true,
    }),
    Animated.timing(value, {
      toValue: 0,
      duration: 50,
      useNativeDriver: true,
    }),
  ]);
};

// Stagger animation for lists
export const staggerFadeIn = (animations, delay = 100) => {
  return Animated.stagger(
    delay,
    animations.map(anim => fadeIn(anim))
  );
};

// Smooth card entrance
export const cardEntrance = (opacity, translateY, index = 0) => {
  return Animated.parallel([
    fadeIn(opacity, 400, index * 50),
    slideUp(translateY, 30, 400, index * 50),
  ]);
};

// Button press animation
export const buttonPress = (scale) => {
  return Animated.sequence([
    Animated.timing(scale, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }),
    Animated.timing(scale, {
      toValue: 1,
      duration: 100,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }),
  ]);
};

// Success animation
export const successAnimation = (scale, opacity) => {
  return Animated.parallel([
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]),
    fadeIn(opacity, 400),
  ]);
};

// Page transition
export const pageTransition = (opacity, translateX) => {
  return Animated.parallel([
    fadeIn(opacity, 300),
    Animated.timing(translateX, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
  ]);
};

