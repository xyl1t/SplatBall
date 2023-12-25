import { Types, defineComponent, defineDeserializer, defineSerializer } from "bitecs";

export const Position = defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32 });

const serializationConfig = [
  Position,
];

export const serialize = defineSerializer(serializationConfig);
export const deserialize = defineDeserializer(serializationConfig);

