export class CNFBuilder {
  public clauses: number[][] = [];
  public varCount = 0;

  constructor(initialVarCount = 0) {
    this.varCount = initialVarCount;
  }

  allocAux(n = 1) {
    const first = this.varCount + 1;
    this.varCount += n;
    return Array.from({ length: n }, (_, i) => first + i);
  }

  addClause(...lits: number[]) {
    this.clauses.push(lits);
  }

  addImp(a: number, b: number) {
    // a -> b  ===  ¬a ∨ b
    this.addClause(-a, b);
  }

  addIff(a: number, b: number) {
    this.addImp(a, b);
    this.addImp(b, a);
  }

  atLeastOne(vars: number[]) {
    this.addClause(...vars);
  }

  atMostOnePairwise(vars: number[]) {
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        this.addClause(-vars[i], -vars[j]);
      }
    }
  }

  // Sinz sequential encoding: linear at-most-one
  atMostOneSequential(vars: number[]) {
    const n = vars.length;
    if (n <= 1) return;
    if (n === 2) {
      this.addClause(-vars[0], -vars[1]);
      return;
    }
    const s = this.allocAux(n - 1); // s1..s_{n-1}

    // (-x1 v s1)
    this.addClause(-vars[0], s[0]);

    // for i=2..n-1:
    for (let i = 1; i < n - 1; i++) {
      // (-xi v si)
      this.addClause(-vars[i], s[i]);
      // (-s_{i-1} v si)
      this.addClause(-s[i - 1], s[i]);
      // (-xi v -s_{i-1})
      this.addClause(-vars[i], -s[i - 1]);
    }

    // (-xn v -s_{n-1})
    this.addClause(-vars[n - 1], -s[n - 2]);
  }

  exactlyOne(vars: number[], method: 'seq' | 'pair' = 'seq') {
    this.atLeastOne(vars);
    if (method === 'pair') this.atMostOnePairwise(vars);
    else this.atMostOneSequential(vars);
  }

  toDimacs(): string {
    const lines: string[] = [];
    lines.push(`p cnf ${this.varCount} ${this.clauses.length}`);
    for (const c of this.clauses) lines.push(`${c.join(' ')} 0`);
    return lines.join('\n');
  }
}
