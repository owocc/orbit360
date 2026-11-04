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
  let dstW = containerW;
  let dstH = containerH;
  let dstX = 0;
  let dstY = 0;

  if (cw > 0 && ch > 0 && containerW > 0 && containerH > 0) {
    const fit = controller.fit;
    const scale =
      fit === "cover"
        ? cw / ch > containerW / containerH
          ? containerH / ch
          : containerW / cw
        : cw / ch > containerW / containerH
          ? containerW / cw
          : containerH / ch;

    dstW = cw * scale;
    dstH = ch * scale;
    dstX = (containerW - dstW) / 2.0;
    dstY = (containerH - dstH) / 2.0;
  }

  const sx = cw > 0 ? dstW / cw : 1;
  const sy = ch > 0 ? dstH / ch : 1;

  return (
    <View style={[styles.container, style]} onLayout={handleLayout} {...panResponder.panHandlers}>
      {controller.isReady &&
        controller.layers.map((layer, index) => {
          const uri = controller.currentFrameForLayer(index);
          if (!uri) return null;

          const r = layer.rect;
          const left = dstX + r.x * sx;
          const top = dstY + r.y * sy;
          const width = r.width * sx;
          const height = r.height * sy;

          return (
            <Image
              key={index}
              source={{ uri }}
              fadeDuration={0}
              resizeMode="stretch"
              style={[
                styles.layerImage,
                {
                  left,
                  top,
                  width,
                  height,
                },
              ]}
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
