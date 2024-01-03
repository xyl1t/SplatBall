// NOTE: not my code, copied from here https://gist.github.com/ahtcx/0cd94e62691f539160b32ecda18af3d6?permalink_comment_id=4594127#gistcomment-4594127
/*!
 * Deep merge two or more objects or arrays.
 * (c) 2023 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param   {*} ...objs  The arrays or objects to merge
 * @returns {*}          The merged arrays or objects
 */
export function deepMerge(...objs: any): any {
  function getType(obj: any): string {
    return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
  }

  /**
   * Deep merge two objects
   * @return {Object}
   */
  function mergeObj(clone: any, obj: any): any {
    for (let [key, value] of Object.entries(obj)) {
      let type = getType(value);
      if (
        clone[key] !== undefined &&
        getType(clone[key]) === type &&
        ["array", "object"].includes(type)
      ) {
        clone[key] = deepMerge(clone[key], value);
      } else {
        clone[key] = structuredClone(value);
      }
    }
  }

  // Create a clone of the first item in the objs array
  let clone = structuredClone(objs.shift());

  // Loop through each item
  for (let obj of objs) {
    // Get the object type
    let type = getType(obj);

    // If the current item isn"t the same type as the clone, replace it
    if (getType(clone) !== type) {
      clone = structuredClone(obj);
      continue;
    }

    // Otherwise, merge
    if (type === "array") {
      clone = [...clone, ...structuredClone(obj)];
    } else if (type === "object") {
      mergeObj(clone, obj);
    } else {
      clone = obj;
    }
  }

  return clone;
}
