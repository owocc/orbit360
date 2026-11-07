import React, { useEffect, useReducer, useRef } from "react";
import {
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { OrbitRenderController } from "./controller";

export interface OrbitRenderWidgetProps {
  controller: OrbitRenderController;
  style?: ViewStyle;
}

export const OrbitRenderWidget = ({ controller, style }: OrbitRenderWidgetProps) => {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const layoutRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const unsub = controller.addListener(() => {
      forceUpdate();
    });

    let running = true;
    let animId: number;
    const loop = () => {
      if (!running) return;
      if (controller.isReady) {
        controller.tick(Date.now());
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(animId);
      unsub();
    };
  }, [controller]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        controller.onPointerDown(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        controller.onPointerMove(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      },
      onPanResponderRelease: () => {
        controller.onPointerUp();
      },
      onPanResponderTerminate: () => {
        controller.onPointerUp();
      },
    }),
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    console.log("OrbitRenderWidget onLayout:", width, height);
    layoutRef.current = { width, height };
    forceUpdate();
  };

  const { width: containerW, height: containerH } = layoutRef.current;
  const cw = controller.canvasWidth;
  const ch = controller.canvasHeight;
  console.log(
    "Widget render: isReady=",
    controller.isReady,
    "container=",
    containerW,
    containerH,
    "canvas=",
    cw,
    ch,
    "layers=",
    controller.layers.length,
  );
  const plan =
    cw > 0 && ch > 0 && containerW > 0 && containerH > 0
      ? controller.layout({ width: containerW, height: containerH })
      : null;

  return (
    <View style={[styles.container, style]} onLayout={handleLayout} {...panResponder.panHandlers}>
      {controller.isReady &&
        controller.layers.map((_layer, index) => {
          const uri = controller.currentFrameForLayer(index);
          if (!uri) return null;

          const rect = plan?.layers[index]?.rect ?? {
            x: 0,
            y: 0,
            width: containerW,
            height: containerH,
          };
          const left = rect.x;
          const top = rect.y;
          const width = rect.width;
          const height = rect.height;

          return (
            <Image
              key={index}
              source={{ uri }}
              fadeDuration={0}
              resizeMode="stretch"
              style={[styles.layerImage, { left, top, width, height }]}
            />
          );
        })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  layerImage: {
    position: "absolute",
  },
});
