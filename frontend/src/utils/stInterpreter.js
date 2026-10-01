/**
 * stInterpreter.js
 * Intérprete completo de Structured Text (IEC 61131-3) para el OT Cyber Range Lab.
 * Ejecuta código ST real dentro del sandbox del navegador.
 *
 * Soporta:
 *   - IF / THEN / ELSIF / ELSE / END_IF
 *   - FOR / TO / BY / DO / END_FOR
 *   - WHILE / DO / END_WHILE
 *   - REPEAT / UNTIL
 *   - Asignaciones  :=
 *   - Aritméticas   + - * / MOD
 *   - Comparaciones = <> < > <= >=
 *   - Lógicas       AND OR XOR NOT
 *   - Literales     INT REAL BOOL STRING
 *   - VAR / END_VAR declarations
 *   - PROGRAM / NETWORK (ignorados, sólo parsing del cuerpo)
 *   - Comentarios   (* ... *) y // ...
 *   - Bloques de función básicos: TON, TOF, CTU, CTD, R_TRIG, F_TRIG, ABS, SQRT, MAX, MIN
 */

/* ══════════════════════════════════════════════════════════════════════════
   TOKENIZER
══════════════════════════════════════════════════════════════════════════ */

const KEYWORDS = new Set([
    'PROGRAM','END_PROGRAM','VAR','END_VAR','VAR_INPUT','VAR_OUTPUT','VAR_IN_OUT',
    'VAR_GLOBAL','END_VAR_GLOBAL','TYPE','END_TYPE','STRUCT','END_STRUCT',
    'FUNCTION','END_FUNCTION','FUNCTION_BLOCK','END_FUNCTION_BLOCK',
    'NETWORK','IF','THEN','ELSIF','ELSE','END_IF',
    'FOR','TO','BY','DO','END_FOR',
    'WHILE','END_WHILE','REPEAT','UNTIL',
    'CASE','OF','END_CASE','RETURN','EXIT',
    'AND','OR','XOR','NOT','MOD','DIV',
    'TRUE','FALSE',
    'BOOL','INT','UINT','DINT','UDINT','LINT','REAL','LREAL',
    'STRING','WSTRING','BYTE','WORD','DWORD','LWORD','TIME','DATE',
    'AT','RETAIN','CONSTANT',
  ]);
  
  function tokenize(code) {
    const tokens = [];
    let i = 0;
  
    while (i < code.length) {
      // Skip whitespace
      if (/\s/.test(code[i])) { i++; continue; }
  
      // Block comment (* ... *)
      if (code[i] === '(' && code[i+1] === '*') {
        i += 2;
        while (i < code.length && !(code[i] === '*' && code[i+1] === ')')) i++;
        i += 2;
        continue;
      }
  
      // Line comment //
      if (code[i] === '/' && code[i+1] === '/') {
        while (i < code.length && code[i] !== '\n') i++;
        continue;
      }
  
      // String literal '...'
      if (code[i] === "'") {
        let s = '';
        i++;
        while (i < code.length && code[i] !== "'") s += code[i++];
        i++;
        tokens.push({ type: 'STRING_LIT', value: s });
        continue;
      }
  
      // String literal "..."
      if (code[i] === '"') {
        let s = '';
        i++;
        while (i < code.length && code[i] !== '"') s += code[i++];
        i++;
        tokens.push({ type: 'STRING_LIT', value: s });
        continue;
      }
  
      // Number (integer or real)
      if (/\d/.test(code[i])) {
        let s = '';
        while (i < code.length && /[\d.]/.test(code[i])) s += code[i++];
        // Scientific notation
        if (i < code.length && (code[i] === 'e' || code[i] === 'E')) {
          s += code[i++];
          if (code[i] === '+' || code[i] === '-') s += code[i++];
          while (i < code.length && /\d/.test(code[i])) s += code[i++];
        }
        tokens.push({ type: 'NUMBER', value: Number(s) });
        continue;
      }
  
      // Identifier or keyword
      if (/[A-Za-z_]/.test(code[i])) {
        let s = '';
        while (i < code.length && /[\w]/.test(code[i])) s += code[i++];
        const upper = s.toUpperCase();
        if (KEYWORDS.has(upper)) tokens.push({ type: upper, value: s });
        else tokens.push({ type: 'IDENT', value: s });
        continue;
      }
  
      // Two-char operators
      const two = code.slice(i, i+2);
      if ([':=', '<>', '<=', '>=', '**'].includes(two)) {
        tokens.push({ type: two, value: two });
        i += 2;
        continue;
      }
  
      // Single-char operators / punctuation
      const ch = code[i];
      if ('=<>+-*/;:,.()[]{}%#@'.includes(ch)) {
        tokens.push({ type: ch, value: ch });
        i++;
        continue;
      }
  
      i++; // skip unknown
    }
  
    tokens.push({ type: 'EOF', value: '' });
    return tokens;
  }
  
  /* ══════════════════════════════════════════════════════════════════════════
     PARSER  (recursive descent)
  ══════════════════════════════════════════════════════════════════════════ */
  
  class Parser {
    constructor(tokens) {
      this.tokens = tokens;
      this.pos    = 0;
    }
  
    peek(offset = 0) { return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]; }
    advance()        { return this.tokens[this.pos < this.tokens.length ? this.pos++ : this.pos]; }
  
    expect(type) {
      const t = this.advance();
      if (t.type !== type) throw new SyntaxError(`Expected ${type}, got '${t.value}' (${t.type}) at token ${this.pos}`);
      return t;
    }
  
    match(...types) {
      if (types.includes(this.peek().type)) { this.advance(); return true; }
      return false;
    }
  
    parseProgram() {
      const stmts = [];
      while (this.peek().type !== 'EOF') {
        const t = this.peek();
        // Skip PROGRAM / NETWORK / VAR blocks at top level
        if (t.type === 'PROGRAM') {
          this.advance(); this.advance(); // PROGRAM name
          continue;
        }
        if (t.type === 'END_PROGRAM') { this.advance(); continue; }
        if (t.type === 'NETWORK')     { this.advance(); this.advance(); continue; } // NETWORK N
        if (t.type === 'VAR' || t.type === 'VAR_INPUT' || t.type === 'VAR_OUTPUT') {
          this.parseVarBlock(); continue;
        }
        const stmt = this.parseStatement();
        if (stmt) stmts.push(stmt);
      }
      return { type: 'PROGRAM', body: stmts };
    }
  
    parseVarBlock() {
      this.advance(); // VAR keyword
      const decls = [];
      while (!['END_VAR','EOF'].includes(this.peek().type)) {
        if (this.peek().type === 'IDENT') {
          const name = this.advance().value;
          let initVal = null;
          // name : TYPE := value;
          if (this.peek().type === ':') {
            this.advance(); // :
            const typeName = this.advance().value; // type
            if (this.peek().type === ':=') {
              this.advance(); // :=
              initVal = this.parseExpr();
            }
          }
          if (this.peek().type === ';') this.advance();
          decls.push({ name, initVal });
        } else {
          this.advance(); // skip
        }
      }
      if (this.peek().type === 'END_VAR') this.advance();
      return { type: 'VAR_BLOCK', decls };
    }
  
    parseStatements(stopAt = []) {
      const stmts = [];
      const stopSet = new Set(['EOF', ...stopAt]);
      while (!stopSet.has(this.peek().type)) {
        if (['END_VAR'].includes(this.peek().type)) break;
        const stmt = this.parseStatement();
        if (stmt) stmts.push(stmt);
      }
      return stmts;
    }
  
    parseStatement() {
      const t = this.peek();
  
      if (t.type === 'IF')     return this.parseIf();
      if (t.type === 'FOR')    return this.parseFor();
      if (t.type === 'WHILE')  return this.parseWhile();
      if (t.type === 'REPEAT') return this.parseRepeat();
      if (t.type === 'CASE')   return this.parseCase();
      if (t.type === 'RETURN') { this.advance(); if (this.peek().type === ';') this.advance(); return { type: 'RETURN' }; }
      if (t.type === 'EXIT')   { this.advance(); if (this.peek().type === ';') this.advance(); return { type: 'EXIT' }; }
      if (t.type === ';')      { this.advance(); return null; }
  
      // Assignment or function call
      if (t.type === 'IDENT') {
        const name = this.advance().value;
        // Function call: IDENT(...)
        if (this.peek().type === '(') {
          const args = this.parseCallArgs();
          if (this.peek().type === ';') this.advance();
          return { type: 'CALL', name, args };
        }
        // Qualified name IDENT.MEMBER
        if (this.peek().type === '.' && this.peek(1).type === 'IDENT') {
          this.advance(); // .
          const member = this.advance().value;
          this.expect(':=');
          const value = this.parseExpr();
          if (this.peek().type === ';') this.advance();
          return { type: 'ASSIGN_MEMBER', name, member, value };
        }
        // Assignment IDENT :=
        if (this.peek().type === ':=') {
          this.advance(); // :=
          const value = this.parseExpr();
          if (this.peek().type === ';') this.advance();
          return { type: 'ASSIGN', name, value };
        }
        // Function call statement with named params: NAME(param1:=val1, ...)
        if (this.peek().type === '(') {
          const args = this.parseCallArgs();
          if (this.peek().type === ';') this.advance();
          return { type: 'CALL', name, args };
        }
        // Just a semicolon
        if (this.peek().type === ';') { this.advance(); return null; }
        // Skip unknown
        return null;
      }
  
      // Skip unknown tokens
      this.advance();
      return null;
    }
  
    parseCallArgs() {
      this.expect('(');
      const args = [];
      while (this.peek().type !== ')' && this.peek().type !== 'EOF') {
        // Named param: NAME := expr
        if (this.peek().type === 'IDENT' && this.peek(1).type === ':=') {
          const paramName = this.advance().value;
          this.advance(); // :=
          const val = this.parseExpr();
          args.push({ type: 'NAMED_ARG', name: paramName, value: val });
        } else {
          args.push(this.parseExpr());
        }
        if (this.peek().type === ',') this.advance();
      }
      if (this.peek().type === ')') this.advance();
      return args;
    }
  
    parseIf() {
      this.expect('IF');
      const cond   = this.parseExpr();
      this.expect('THEN');
      const body   = this.parseStatements(['ELSIF','ELSE','END_IF']);
      const elseifs = [];
      while (this.peek().type === 'ELSIF') {
        this.advance();
        const ec = this.parseExpr();
        this.expect('THEN');
        const eb = this.parseStatements(['ELSIF','ELSE','END_IF']);
        elseifs.push({ cond: ec, body: eb });
      }
      let elseBody = [];
      if (this.peek().type === 'ELSE') {
        this.advance();
        elseBody = this.parseStatements(['END_IF']);
      }
      this.expect('END_IF');
      if (this.peek().type === ';') this.advance();
      return { type: 'IF', cond, body, elseifs, elseBody };
    }
  
    parseFor() {
      this.expect('FOR');
      const varName = this.expect('IDENT').value;
      this.expect(':=');
      const from  = this.parseExpr();
      this.expect('TO');
      const to    = this.parseExpr();
      let   by    = { type: 'LIT', value: 1 };
      if (this.peek().type === 'BY') { this.advance(); by = this.parseExpr(); }
      this.expect('DO');
      const body  = this.parseStatements(['END_FOR']);
      this.expect('END_FOR');
      if (this.peek().type === ';') this.advance();
      return { type: 'FOR', varName, from, to, by, body };
    }
  
    parseWhile() {
      this.expect('WHILE');
      const cond = this.parseExpr();
      this.expect('DO');
      const body = this.parseStatements(['END_WHILE']);
      this.expect('END_WHILE');
      if (this.peek().type === ';') this.advance();
      return { type: 'WHILE', cond, body };
    }
  
    parseRepeat() {
      this.expect('REPEAT');
      const body = this.parseStatements(['UNTIL']);
      this.expect('UNTIL');
      const cond = this.parseExpr();
      if (this.peek().type === ';') this.advance();
      return { type: 'REPEAT', body, cond };
    }
  
    parseCase() {
      this.expect('CASE');
      const expr  = this.parseExpr();
      this.expect('OF');
      const cases = [];
      while (!['END_CASE','ELSE','EOF'].includes(this.peek().type)) {
        const values = [];
        values.push(this.parsePrimary()); // case value
        while (this.peek().type === ',') { this.advance(); values.push(this.parsePrimary()); }
        this.expect(':');
        const body = this.parseStatements(['END_CASE','ELSE']);
        cases.push({ values, body });
      }
      let elseBody = [];
      if (this.peek().type === 'ELSE') { this.advance(); elseBody = this.parseStatements(['END_CASE']); }
      this.expect('END_CASE');
      if (this.peek().type === ';') this.advance();
      return { type: 'CASE', expr, cases, elseBody };
    }
  
    /* ── Expression parsing (precedence climbing) ── */
    parseExpr()    { return this.parseOr(); }
  
    parseOr() {
      let l = this.parseXor();
      while (['OR'].includes(this.peek().type)) {
        const op = this.advance().type;
        l = { type: 'BIN', op, left: l, right: this.parseXor() };
      }
      return l;
    }
  
    parseXor() {
      let l = this.parseAnd();
      while (this.peek().type === 'XOR') {
        this.advance();
        l = { type: 'BIN', op: 'XOR', left: l, right: this.parseAnd() };
      }
      return l;
    }
  
    parseAnd() {
      let l = this.parseNot();
      while (this.peek().type === 'AND') {
        this.advance();
        l = { type: 'BIN', op: 'AND', left: l, right: this.parseNot() };
      }
      return l;
    }
  
    parseNot() {
      if (this.peek().type === 'NOT') { this.advance(); return { type: 'UNA', op: 'NOT', operand: this.parseNot() }; }
      return this.parseCompare();
    }
  
    parseCompare() {
      let l = this.parseAdd();
      while (['=','<>','<','>','<=','>='].includes(this.peek().type)) {
        const op = this.advance().type;
        l = { type: 'BIN', op, left: l, right: this.parseAdd() };
      }
      return l;
    }
  
    parseAdd() {
      let l = this.parseMul();
      while (['+','-'].includes(this.peek().type)) {
        const op = this.advance().type;
        l = { type: 'BIN', op, left: l, right: this.parseMul() };
      }
      return l;
    }
  
    parseMul() {
      let l = this.parseUnary();
      while (['*','/','MOD','DIV'].includes(this.peek().type)) {
        const op = this.advance().type;
        l = { type: 'BIN', op, left: l, right: this.parseUnary() };
      }
      return l;
    }
  
    parseUnary() {
      if (this.peek().type === '-') { this.advance(); return { type: 'UNA', op: '-', operand: this.parsePrimary() }; }
      if (this.peek().type === '+') { this.advance(); return this.parsePrimary(); }
      return this.parsePrimary();
    }
  
    parsePrimary() {
      const t = this.peek();
  
      if (t.type === 'NUMBER')     { this.advance(); return { type: 'LIT', value: t.value }; }
      if (t.type === 'STRING_LIT') { this.advance(); return { type: 'LIT', value: t.value }; }
      if (t.type === 'TRUE')       { this.advance(); return { type: 'LIT', value: true }; }
      if (t.type === 'FALSE')      { this.advance(); return { type: 'LIT', value: false }; }
  
      if (t.type === '(') {
        this.advance();
        const expr = this.parseExpr();
        if (this.peek().type === ')') this.advance();
        return expr;
      }
  
      if (t.type === 'IDENT') {
        const name = this.advance().value;
        // Function call
        if (this.peek().type === '(') {
          const args = this.parseCallArgs();
          return { type: 'CALL_EXPR', name, args };
        }
        // Struct member access
        if (this.peek().type === '.' && this.peek(1).type === 'IDENT') {
          this.advance(); // .
          const member = this.advance().value;
          return { type: 'MEMBER', object: name, member };
        }
        return { type: 'VAR', name };
      }
  
      // Skip unexpected token
      this.advance();
      return { type: 'LIT', value: 0 };
    }
  }
  
  /* ══════════════════════════════════════════════════════════════════════════
     EXECUTOR
  ══════════════════════════════════════════════════════════════════════════ */
  
  class Executor {
    constructor(initialVars = {}) {
      this.vars    = {};
      // Normalise: store under both original and UPPER key
      for (const [k, v] of Object.entries(initialVars)) {
        this.vars[k]          = v;
        this.vars[k.toUpperCase()] = v;
      }
      this.iterations  = 0;
      this.MAX_ITER    = 50000;
      this.output      = [];
      this.exitFlag    = false;
      this.timers      = {};  // FB timer states
    }
  
    getVar(name) {
      const v = this.vars[name] ?? this.vars[name.toUpperCase()];
      return v ?? 0;
    }
  
    setVar(name, value) {
      this.vars[name]           = value;
      this.vars[name.toUpperCase()] = value;
    }
  
    checkIter() {
      if (++this.iterations > this.MAX_ITER) throw new Error('Max iterations exceeded — possible infinite loop');
    }
  
    execNode(node) {
      this.checkIter();
      if (!node) return undefined;
  
      switch (node.type) {
  
        case 'LIT':  return node.value;
        case 'VAR':  return this.getVar(node.name);
        case 'MEMBER': {
          // FB.Q, FB.ET, etc.
          const key = `${node.object}.${node.member}`;
          return this.getVar(key);
        }
  
        case 'BIN': {
          const l = this.execNode(node.left);
          const r = this.execNode(node.right);
          switch (node.op) {
            case '+':   return +l + +r;
            case '-':   return +l - +r;
            case '*':   return +l * +r;
            case '/':   return r !== 0 ? +l / +r : 0;
            case 'MOD': case '%': return +r !== 0 ? (+l % +r) : 0;
            case 'DIV': return r !== 0 ? Math.trunc(+l / +r) : 0;
            case '=':   return l == r;   // eslint-disable-line eqeqeq
            case '<>':  return l != r;   // eslint-disable-line eqeqeq
            case '<':   return +l < +r;
            case '>':   return +l > +r;
            case '<=':  return +l <= +r;
            case '>=':  return +l >= +r;
            case 'AND': return Boolean(l) && Boolean(r);
            case 'OR':  return Boolean(l) || Boolean(r);
            case 'XOR': return Boolean(l) !== Boolean(r);
          }
          return 0;
        }
  
        case 'UNA': {
          const v = this.execNode(node.operand);
          if (node.op === 'NOT') return !v;
          if (node.op === '-')   return -v;
          return v;
        }
  
        case 'ASSIGN': {
          const val = this.execNode(node.value);
          this.setVar(node.name, val);
          return val;
        }
  
        case 'ASSIGN_MEMBER': {
          const val = this.execNode(node.value);
          const key = `${node.name}.${node.member}`;
          this.setVar(key, val);
          return val;
        }
  
        case 'IF': {
          if (this.execNode(node.cond)) {
            this.execBlock(node.body);
          } else {
            let handled = false;
            for (const ei of node.elseifs) {
              if (this.execNode(ei.cond)) { this.execBlock(ei.body); handled = true; break; }
            }
            if (!handled) this.execBlock(node.elseBody);
          }
          return undefined;
        }
  
        case 'FOR': {
          let cv = this.execNode(node.from);
          this.setVar(node.varName, cv);
          const to = this.execNode(node.to);
          const by = this.execNode(node.by);
          let safety = 0;
          const forward = by >= 0;
          while ((forward ? cv <= to : cv >= to) && safety++ < 10000) {
            this.execBlock(node.body);
            if (this.exitFlag) { this.exitFlag = false; break; }
            cv += by;
            this.setVar(node.varName, cv);
          }
          return undefined;
        }
  
        case 'WHILE': {
          let safety = 0;
          while (this.execNode(node.cond) && safety++ < 10000) {
            this.execBlock(node.body);
            if (this.exitFlag) { this.exitFlag = false; break; }
          }
          return undefined;
        }
  
        case 'REPEAT': {
          let safety = 0;
          do {
            this.execBlock(node.body);
            if (this.exitFlag) { this.exitFlag = false; break; }
          } while (!this.execNode(node.cond) && safety++ < 10000);
          return undefined;
        }
  
        case 'CASE': {
          const val = this.execNode(node.expr);
          let matched = false;
          for (const c of node.cases) {
            const vals = c.values.map(v => this.execNode(v));
            if (vals.some(v => v == val)) { // eslint-disable-line eqeqeq
              this.execBlock(c.body); matched = true; break;
            }
          }
          if (!matched) this.execBlock(node.elseBody);
          return undefined;
        }
  
        case 'RETURN': return undefined;
        case 'EXIT':   this.exitFlag = true; return undefined;
  
        case 'CALL':
        case 'CALL_EXPR': {
          return this.callFunction(node.name.toUpperCase(), node.args);
        }
  
        case 'PROGRAM': {
          this.execBlock(node.body);
          return undefined;
        }
  
        default:
          return undefined;
      }
    }
  
    execBlock(stmts) {
      for (const s of (stmts || [])) {
        if (this.exitFlag) break;
        this.execNode(s);
      }
    }
  
    callFunction(name, args) {
      const resolveArgs = () => args.map(a => a.type === 'NAMED_ARG' ? this.execNode(a.value) : this.execNode(a));
      const namedArgs   = () => {
        const m = {};
        args.forEach(a => { if (a.type === 'NAMED_ARG') m[a.name.toUpperCase()] = this.execNode(a.value); });
        return m;
      };
  
      switch (name) {
        // Math
        case 'ABS':   return Math.abs(resolveArgs()[0]  ?? 0);
        case 'SQRT':  return Math.sqrt(resolveArgs()[0] ?? 0);
        case 'SQR':   return Math.sqrt(resolveArgs()[0] ?? 0);
        case 'LN':    return Math.log(resolveArgs()[0]  ?? 1);
        case 'LOG':   return Math.log10(resolveArgs()[0]?? 1);
        case 'EXP':   return Math.exp(resolveArgs()[0]  ?? 0);
        case 'SIN':   return Math.sin(resolveArgs()[0]  ?? 0);
        case 'COS':   return Math.cos(resolveArgs()[0]  ?? 0);
        case 'TAN':   return Math.tan(resolveArgs()[0]  ?? 0);
        case 'ASIN':  return Math.asin(resolveArgs()[0] ?? 0);
        case 'ACOS':  return Math.acos(resolveArgs()[0] ?? 0);
        case 'ATAN':  return Math.atan(resolveArgs()[0] ?? 0);
        case 'MAX':   { const a = resolveArgs(); return Math.max(...a.map(Number)); }
        case 'MIN':   { const a = resolveArgs(); return Math.min(...a.map(Number)); }
        case 'LIMIT': { const a = resolveArgs(); return Math.min(Math.max(a[0], a[1]), a[2]); }
        case 'TRUNC': return Math.trunc(resolveArgs()[0] ?? 0);
        case 'ROUND': return Math.round(resolveArgs()[0] ?? 0);
        case 'FLOOR': return Math.floor(resolveArgs()[0] ?? 0);
        case 'CEIL':  return Math.ceil(resolveArgs()[0]  ?? 0);
        case 'EXPT':  { const a = resolveArgs(); return Math.pow(a[0], a[1]); }
  
        // Type conversions
        case 'INT_TO_REAL': case 'DINT_TO_REAL': return Number(resolveArgs()[0]);
        case 'REAL_TO_INT': case 'REAL_TO_DINT': return Math.trunc(resolveArgs()[0]);
        case 'BOOL_TO_INT': return resolveArgs()[0] ? 1 : 0;
        case 'INT_TO_BOOL': return resolveArgs()[0] !== 0;
  
        // String
        case 'LEN':    return String(resolveArgs()[0] ?? '').length;
        case 'LEFT':   { const a = resolveArgs(); return String(a[0]).slice(0, a[1]); }
        case 'RIGHT':  { const a = resolveArgs(); return String(a[0]).slice(-a[1]); }
        case 'MID':    { const a = resolveArgs(); return String(a[0]).substr(a[1]-1, a[2]); }
        case 'CONCAT': return resolveArgs().map(String).join('');
  
        // Timer function blocks (simplified, stateless simulation)
        case 'TON': {
          const na = namedArgs();
          const in_  = Boolean(na['IN'] ?? na['IN_']  ?? resolveArgs()[0]);
          const pt   = Number(na['PT']  ?? 0);
          const fbName = args.find(a => a.name === 'IN' || a.name === 'IN_')?.name ?? 'TON';
          // Simulate: if IN=TRUE, output Q after PT milliseconds (simplified: Q=IN)
          const q = in_; // simplified: instant (use real timing if needed)
          if (fbName !== 'TON') this.setVar(`${fbName}.Q`,  q);
          return q;
        }
  
        case 'TOF': {
          const na = namedArgs();
          const in_ = Boolean(na['IN'] ?? resolveArgs()[0]);
          return !in_; // simplified
        }
  
        case 'CTU': {
          const na  = namedArgs();
          const cu  = Boolean(na['CU'] ?? false);
          const r   = Boolean(na['R']  ?? false);
          const pv  = Number(na['PV']  ?? 0);
          const key = `${name}_cv_${this.iterations}`;
          if (r) { this.setVar(key, 0); return false; }
          let cv = Number(this.getVar(key)) || 0;
          if (cu) cv++;
          this.setVar(key, cv);
          return cv >= pv;
        }
  
        case 'R_TRIG': {
          const in_ = Boolean(resolveArgs()[0]);
          const key = `R_TRIG_prev_${this.iterations}`;
          const prev = Boolean(this.getVar(key));
          this.setVar(key, in_);
          return in_ && !prev;
        }
  
        case 'F_TRIG': {
          const in_ = Boolean(resolveArgs()[0]);
          const key = `F_TRIG_prev_${this.iterations}`;
          const prev = Boolean(this.getVar(key));
          this.setVar(key, in_);
          return !in_ && prev;
        }
  
        default:
          // Unknown function — return 0 silently
          return 0;
      }
    }
  }
  
  /* ══════════════════════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════════════════════ */
  
  /**
   * Compila código ST y retorna el AST o errores de sintaxis.
   * @returns {{ ast, errors, warnings }}
   */
  export function compileSTCode(code) {
    const errors = [], warnings = [];
    try {
      const tokens = tokenize(code);
      const parser = new Parser(tokens);
      const ast    = parser.parseProgram();
      return { ast, errors, warnings };
    } catch (e) {
      errors.push({ message: e.message, line: null });
      return { ast: null, errors, warnings };
    }
  }
  
  /**
   * Ejecuta código ST contra un conjunto de variables.
   * Retorna las variables actualizadas y cualquier error de runtime.
   * @param {string}  code          — Código ST como string
   * @param {object}  initialVars   — Diccionario { VARIABLE: valor, ... }
   * @returns {{ success, vars, errors, warnings, changedVars }}
   */
  export function executeSTCode(code, initialVars = {}) {
    const { ast, errors: syntaxErrors } = compileSTCode(code);
    if (syntaxErrors.length > 0) {
      return { success: false, vars: initialVars, errors: syntaxErrors, warnings: [], changedVars: {} };
    }
  
    try {
      const exec    = new Executor(initialVars);
      exec.execNode(ast);
  
      // Find what changed
      const changedVars = {};
      for (const [k, v] of Object.entries(exec.vars)) {
        // Only original-case keys
        if (k === k.toUpperCase() && k in exec.vars) continue; // skip UPPER duplicates
        const origVal = initialVars[k] ?? initialVars[k?.toUpperCase()];
        if (origVal !== v) changedVars[k] = { from: origVal, to: v };
      }
  
      // Collect only original-cased vars
      const finalVars = {};
      for (const k of Object.keys(initialVars)) {
        finalVars[k] = exec.vars[k] ?? exec.vars[k.toUpperCase()] ?? initialVars[k];
      }
      // Also pick up any new vars assigned by the code (lowercase name)
      for (const k of Object.keys(exec.vars)) {
        if (!(k in finalVars) && k !== k.toUpperCase()) finalVars[k] = exec.vars[k];
      }
  
      return { success: true, vars: finalVars, errors: [], warnings: [], changedVars };
    } catch (e) {
      return { success: false, vars: initialVars, errors: [{ message: e.message }], warnings: [], changedVars: {} };
    }
  }
  
  /**
   * Extrae la declaración VAR del código ST y devuelve el diccionario inicial.
   */
  export function extractVarDeclarations(code) {
    const vars = {};
    const varBlock = code.match(/VAR[\s\S]*?END_VAR/gi) || [];
    for (const block of varBlock) {
      const lines = block.replace(/VAR[_A-Z]*/gi, '').replace(/END_VAR/gi, '').split('\n');
      for (const line of lines) {
        const m = line.match(/^\s*(\w+)\s*:\s*\w+\s*(?::=\s*([^;]+))?;/);
        if (m) {
          const name = m[1];
          const raw  = m[2]?.trim();
          if (raw === undefined) { vars[name] = 0; continue; }
          if (raw.toUpperCase() === 'TRUE')  { vars[name] = true;  continue; }
          if (raw.toUpperCase() === 'FALSE') { vars[name] = false; continue; }
          const n = parseFloat(raw);
          vars[name] = isNaN(n) ? raw : n;
        }
      }
    }
    return vars;
  }
  
  /** Formatea el resultado de una variable para mostrar en tabla */
  export function formatVarValue(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number')  return Number.isInteger(v) ? String(v) : v.toFixed(3);
    return String(v);
  }