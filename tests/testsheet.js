export function draw(k) {
  k.title('test sheet', { sub: 'lines · washes · hatching · chữ tiếng Việt' });
  // straight lines of each weight
  [['bold', 150], ['outline', 185], ['detail', 220], ['fine', 255]].forEach(([w, y]) => k.line(60, y, 440, y, { weight: w }));
  // a long diagonal + a polyline with corners
  k.line([[60, 300], [200, 420], [320, 300], [440, 420]]);
  // shapes with wash
  k.circle(140, 560, 80, { fill: 'red', shade: true });
  k.rect(260, 480, 170, 160, { fill: 'sky', shade: true, hatch: true });
  k.blob(140, 780, 90, { bumps: 9, fill: 'green', shade: 0.3 });
  k.ellipse(345, 780, 85, 60, { fill: '#3355ff' });
  // turned cup
  const cup = k.turned([[90, 0], [92, 40], [80, 120], [60, 150]], { cx: 720, y: 180, fill: 'ochre', rim: true, hatch: true });
  k.tube([[805, 210], [880, 220], [870, 290], [790, 300]], 18, { fill: 'ochre' });
  k.shadow(720, 340, 120);
  // text
  k.text('the quick brown fox jumps over', 520, 440, { size: 24 });
  k.text('THE LAZY DOG 0123456789 ?!&', 520, 480, { size: 24 });
  k.text('Tiếng Việt: phở bò, cà phê sữa đá', 520, 540, { size: 26 });
  k.text('ẤẦẨẪẬ ắằẳẵặ ơớờởỡợ ưứừửữự Đđ', 520, 590, { size: 26 });
  k.text('Nguyễn, Hội An, Huế, Đà Lạt', 520, 640, { size: 26 });
  k.label('margin label', { x: 560, y: 740, to: [430, 790] });
  k.leaf(600, 900, { len: 90, angle: -30 });
  k.leaf(700, 900, { len: 70, angle: -120, fill: 'sage' });
}
