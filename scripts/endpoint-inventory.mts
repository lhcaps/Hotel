export type RouteDecorator = Readonly<{
  method: 'delete' | 'get' | 'patch' | 'post' | 'put';
  path: string;
}>;

const METHOD_DECORATOR = /@(Get|Post|Patch|Put|Delete)\(\s*(?:'([^']*)')?\s*\)/g;

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

export function extractRouteDecorators(source: string): readonly RouteDecorator[] {
  return [...withoutComments(source).matchAll(METHOD_DECORATOR)].map((match) => ({
    method: match[1]!.toLowerCase() as RouteDecorator['method'],
    path: match[2] ?? '',
  }));
}
