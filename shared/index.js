import {
  Types,
  defineComponent,
  defineDeserializer,
  defineSerializer,
} from "bitecs";

export const Me = defineComponent(); // defines the playing entity (the player)

export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
});

export const Color = defineComponent({
  value: Types.i32,
});

export const Box = defineComponent({
  width: Types.f32,
  height: Types.f32,
  depth: Types.f32,
});

export const Sphere = defineComponent({
  radius: Types.f32,
});

export const Mesh = defineComponent({
  assetPath: Types.ui16,
});

// export const Material = defineComponent({
//   color: Types.ui32,
// });

export const componentNames = new Map();
componentNames.set(Me, varToString({ Me }));
componentNames.set(Position, varToString({ Position }));
componentNames.set(Box, varToString({ Box }));
componentNames.set(Color, varToString({ Color }));

const serializationConfig = Array.from(componentNames.keys());

export const serialize = defineSerializer(serializationConfig);
export const deserialize = defineDeserializer(serializationConfig);

function varToString(varObj) {
  return Object.keys(varObj)[0];
}
