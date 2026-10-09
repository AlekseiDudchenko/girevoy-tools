// The schema uses this deliberately small subset of JSON Schema Draft 2020-12.
export function schemaErrors(value, schema, path = '$') {
  const errors=[];
  const type=Array.isArray(value)?'array':value===null?'null':typeof value;
  if (schema.type) {
    const types=Array.isArray(schema.type)?schema.type:[schema.type];
    if (!types.some(t=>t==='integer'?Number.isInteger(value):t===type)) return [`${path}: type`];
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: enum`);
  if (typeof value==='string') {
    if (schema.minLength && value.length<schema.minLength) errors.push(`${path}: minLength`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: pattern`);
  }
  if (typeof value==='number' && schema.minimum!==undefined && value<schema.minimum) errors.push(`${path}: minimum`);
  if (Array.isArray(value)) {
    if (schema.minItems && value.length<schema.minItems) errors.push(`${path}: minItems`);
    if (schema.uniqueItems && new Set(value.map(x=>JSON.stringify(x))).size!==value.length) errors.push(`${path}: uniqueItems`);
    if (schema.items) value.forEach((x,i)=>errors.push(...schemaErrors(x,schema.items,`${path}[${i}]`)));
  } else if (value && typeof value==='object') {
    for (const key of schema.required||[]) if (!Object.hasOwn(value,key)) errors.push(`${path}.${key}: required`);
    for (const [key,item] of Object.entries(value)) {
      if (schema.properties?.[key]) errors.push(...schemaErrors(item,schema.properties[key],`${path}.${key}`));
      else if (schema.additionalProperties===false) errors.push(`${path}.${key}: additionalProperties`);
    }
  }
  return errors;
}
