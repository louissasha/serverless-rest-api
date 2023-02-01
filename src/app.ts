function test(a: number, b: number, c: string) {
  //something
  return a + b;
}

const dir = __dirname;
const file = __filename;

//console.dir(test.arguments);
//console.dir(test.caller.toString());
console.dir(test.length);
console.dir(test.name);
console.dir(test.prototype);
console.dir(test.toString());
console.dir(test, { depth: null });
console.info(dir);
console.info(file);
