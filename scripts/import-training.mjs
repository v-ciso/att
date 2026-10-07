import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const input = new URL('../lib/training/source.html', import.meta.url);
const html = readFileSync(input, 'utf8');
const script = html.match(/<script type="text\/x-dc" data-dc-script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Practice source script not found');
const ast = ts.createSourceFile('practice.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

// Read literal data only. The uploaded template and its executable code never run.
function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.map(property => {
      if (!ts.isPropertyAssignment(property) || (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))) throw new Error('Unsupported source property');
      return [property.name.text, literal(property.initializer)];
    }));
  }
  throw new Error(`Nonliteral content refused: ${node.kind}`);
}

const extracted = {};
for (const statement of ast.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    const name = declaration.name.getText(ast);
    if (!['PROMO', 'PITCH', 'STUDY'].includes(name)) continue;
    let value = declaration.initializer;
    if (name !== 'STUDY') {
      if (!value || !ts.isCallExpression(value) || !ts.isPropertyAccessExpression(value.expression) || value.expression.name.text !== 'map') throw new Error('Unexpected question bank format');
      value = value.expression.expression;
    }
    extracted[name] = literal(value);
  }
}
if (!extracted.PROMO || !extracted.PITCH || !extracted.STUDY) throw new Error('Missing training data');
const questions = rows => rows.map(([topic, q, a, wrong, why], id) => ({ id, topic, q, a, wrong, why }));
const data = { promo: questions(extracted.PROMO), pitch: questions(extracted.PITCH), study: extracted.STUDY };
writeFileSync(new URL('../lib/training/content.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log(`Imported ${data.promo.length} promotions questions, ${data.pitch.length} pitch questions and ${Object.keys(data.study.promo).length + Object.keys(data.study.pitch).length} study topics.`);
