import typescript from 'rollup-plugin-typescript2';
import clear from 'rollup-plugin-clear';
import pkg from './package.json';

export default [
  {
    input: 'src/index.tsx',
    output: [
      {
        file: pkg.main,
        format: 'cjs',
      },
      {
        file: pkg.module,
        format: 'es',
      },
    ],
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ],
    plugins: [
      typescript(),
      clear({
        targets: ['dist'],
      }),
    ],
  },
  {
    input: 'src/index.native.tsx',
    output: [
      {
        file: 'dist/index.native.js',
        format: 'cjs',
      },
      {
        file: 'dist/index.native.es.js',
        format: 'es',
      },
    ],
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ],
    plugins: [
      typescript(),
      clear({
        targets: ['dist'],
      }),
    ],
  },
];
