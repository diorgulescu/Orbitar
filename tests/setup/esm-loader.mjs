// SPDX-License-Identifier: GPL-3.0-or-later
import * as nodeModule from 'node:module';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

function resolveSync(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)) {
    if (context.parentURL && context.parentURL.startsWith('file:')) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const candidateJs = path.resolve(parentDir, specifier + '.js');
      if (fs.existsSync(candidateJs)) {
        return nextResolve(specifier + '.js', context);
      }
    }
  }
  return nextResolve(specifier, context);
}

if (typeof nodeModule.registerHooks === 'function') {
  nodeModule.registerHooks({
    resolve: resolveSync,
  });
} else {
  const hookSource = `
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)) {
    if (context.parentURL && context.parentURL.startsWith('file:')) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const candidateJs = path.resolve(parentDir, specifier + '.js');
      if (fs.existsSync(candidateJs)) {
        return nextResolve(specifier + '.js', context);
      }
    }
  }
  return nextResolve(specifier, context);
}
`;

  nodeModule.register(
    `data:text/javascript;base64,${Buffer.from(hookSource, 'utf8').toString('base64')}`,
    pathToFileURL('./')
  );
}
