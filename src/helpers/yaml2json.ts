import { load, YAML11_SCHEMA, YAMLException } from 'js-yaml'

export const yaml2json = async (key, yaml) => {
  try {
    const parsed = load(yaml, { schema: YAML11_SCHEMA });
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected YAML document root to be a mapping");
    }
    return parsed;
  } catch (error: unknown) {
    const mark = error instanceof YAMLException ? error.mark : undefined;
    const reason =
      error instanceof YAMLException
        ? error.reason
        : error instanceof Error
          ? error.message
          : String(error);
    const errorMessage = `${reason}${mark ? ` at line ${mark.line + 1}, column ${mark.column + 1}` : ''}`;
    console.groupCollapsed(`UIX: Error loading ${key}`);
    console.log(errorMessage);
    console.log(
      yaml.split('\n').map((line: any, i: number) => `${i === mark?.line ? '>>' : '  '}${i + 1}: ${line}`).join('\n')
    );
    console.groupEnd();
    return {};
  }
};
