import {
  Types,
  defineComponent,
  defineDeserializer,
  defineSerializer,
} from "bitecs";

export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
});
export const Me = defineComponent(); // defines the playing entity (the player)

const serializationConfig = [Position, Me];

export const serialize = defineSerializer(serializationConfig);
export const deserialize = defineDeserializer(serializationConfig);
