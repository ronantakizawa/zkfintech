pragma circom 2.1.4;

template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var lc1=0;

    var e2=1;
    for (var i = 0; i<n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] -1 ) === 0;
        lc1 += out[i] * e2;
        e2 = e2+e2;
    }

    lc1 === in;
}

template GreaterEqThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;

    component n2b = Num2Bits(n+1);
    n2b.in <== in[0] - in[1] + (1<<n);  // Changed order
    out <== 1-n2b.out[n];
}

template BalanceCheck() {
    signal input in;
    signal output out;
    
    var threshold = 100000; // $1000 in cents
    
    component gte = GreaterEqThan(64);
    gte.in[0] <== in;        // Balance is first input
    gte.in[1] <== threshold; // Threshold is second input
    
    out <== gte.out;
}

component main = BalanceCheck();