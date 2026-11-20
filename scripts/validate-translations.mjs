import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'src', 'content');

const COLLECTIONS = [
  'services',
  'frameworks',
  'diagnostics',
  'case-studies',
  'insights',
];

const LOCALES = ['en', 'pt-br'];

const errors = [];

function report(message) {
  errors.push(message);
}

async function getMarkdownFiles(directory) {
  const files = [];

  async function walk(currentDirectory) {
    let entries;

    try {
      entries = await readdir(currentDirectory, {
        withFileTypes: true,
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (/\.(md|mdx)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  await walk(directory);
  return files.sort();
}

function extractFrontmatter(source) {
  const normalizedSource = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = normalizedSource.split('\n');

  // Permite linhas em branco antes do delimitador.
  const openingDelimiter = lines.findIndex(
    (line) => line.trim() !== '',
  );

  if (
    openingDelimiter === -1 ||
    lines[openingDelimiter].trim() !== '---'
  ) {
    return null;
  }

  const closingDelimiter = lines.findIndex(
    (line, index) =>
      index > openingDelimiter &&
      line.trim() === '---',
  );

  if (closingDelimiter === -1) {
    return null;
  }

  return lines
    .slice(openingDelimiter + 1, closingDelimiter)
    .join('\n');
}

function readFrontmatterValue(frontmatter, key) {
  const expression = new RegExp(
    `^${key}:\\s*(.*?)\\s*$`,
    'm',
  );

  const match = frontmatter.match(expression);

  if (!match) {
    return null;
  }

  return match[1]
    .replace(/^["']|["']$/g, '')
    .trim();
}

async function validateCollection(collection) {
  const collectionPath = path.join(CONTENT_DIR, collection);
  const files = await getMarkdownFiles(collectionPath);

  const translations = new Map();

  for (const file of files) {
    const relativePath = path.relative(collectionPath, file);
    const expectedLocale = relativePath.split(path.sep)[0];
    const displayPath = path.relative(ROOT, file);

    const source = await readFile(file, 'utf8');
    const frontmatter = extractFrontmatter(source);

    if (frontmatter === null) {
      report(
        `${displayPath}: frontmatter não encontrado ou delimitadores inválidos.`,
      );
      continue;
    }

    const locale = readFrontmatterValue(frontmatter, 'locale');

    const translationKey = readFrontmatterValue(
      frontmatter,
      'translationKey',
    );

    if (!LOCALES.includes(expectedLocale)) {
      report(
        `${displayPath}: idioma inválido na estrutura de pastas. ` +
        `Use ${LOCALES.join(' ou ')}.`,
      );
      continue;
    }

    if (!locale || !LOCALES.includes(locale)) {
      report(
        `${displayPath}: locale ausente ou inválido no frontmatter.`,
      );
      continue;
    }

    if (locale !== expectedLocale) {
      report(
        `${displayPath}: locale "${locale}" não corresponde ` +
        `à pasta "${expectedLocale}".`,
      );
      continue;
    }

    if (!translationKey) {
      report(
        `${displayPath}: translationKey ausente ou vazio.`,
      );
      continue;
    }

    if (!translations.has(translationKey)) {
      translations.set(translationKey, new Map());
    }

    const group = translations.get(translationKey);

    if (group.has(locale)) {
      report(
        `${collection}/${translationKey}: documento duplicado ` +
        `para o idioma "${locale}".`,
      );
      continue;
    }

    group.set(locale, displayPath);
  }

  for (const [translationKey, group] of translations) {
    for (const locale of LOCALES) {
      if (!group.has(locale)) {
        report(
          `${collection}/${translationKey}: tradução "${locale}" ausente.`,
        );
      }
    }
  }

  console.log(
    `  ${collection}: ${translations.size} grupo(s) de tradução.`,
  );
}

async function main() {
  console.log('\nValidando integridade das traduções...\n');

  for (const collection of COLLECTIONS) {
    await validateCollection(collection);
  }

  if (errors.length > 0) {
    console.error('\nFalha na validação:\n');

    for (const error of errors) {
      console.error(`  - ${error}`);
    }

    console.error(
      `\n${errors.length} problema(s) encontrado(s).\n`,
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    '\nValidação concluída: todos os pares de idiomas estão íntegros.\n',
  );
}

main().catch((error) => {
  console.error('\nErro inesperado na validação:', error);
  process.exitCode = 1;
});