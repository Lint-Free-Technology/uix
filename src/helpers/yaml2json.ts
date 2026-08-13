import { load, YAML11_SCHEMA } from 'js-yaml'

export const yaml2json = async (key, yaml) => {
  try {
    const parsed = load(yaml, { schema: YAML11_SCHEMA }) as Record<string, any>;
    return parsed;
  } catch (error: any) {
    const errorMessage = `${error.reason}${error.mark ? ` at line ${error.mark.line + 1}, column ${error.mark.column + 1}` : ''}`;
    console.groupCollapsed(`UIX: Error loading ${key}`);
    console.log(errorMessage);
    console.log(
      yaml.split('\n').map((line: any, i: number) => `${i == error.mark?.line ? '>>' : '  '}${i + 1}: ${line}`).join('\n')
    );
    console.groupEnd();
    return {};
  }
};
