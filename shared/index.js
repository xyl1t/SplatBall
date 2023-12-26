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

export const componentNames = new Map();
componentNames.set(Position, varToString({ Position }));
componentNames.set(Me, varToString({ Me }));

const serializationConfig = [Position, Me];

export const serialize = defineSerializer(serializationConfig);
export const deserialize = defineDeserializer(serializationConfig);


function varToString(varObj) {
  return Object.keys(varObj)[0];
}
