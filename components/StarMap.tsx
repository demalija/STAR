export function Sparkle({ className = '', size = 24 }: { className?: string; size?: number }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 0C22.5 14.7 25.3 17.5 40 20C25.3 22.5 22.5 25.3 20 40C17.5 25.3 14.7 22.5 0 20C14.7 17.5 17.5 14.7 20 0Z" fill="currentColor"/></svg>;
}
export default function StarMap({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'star-map small-map' : 'star-map'} viewBox="0 0 560 620" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="nebula"><stop stopColor="#54746B" stopOpacity=".3"/><stop offset="1" stopColor="#142523" stopOpacity="0"/></radialGradient>
      <radialGradient id="gold-glow"><stop stopColor="#FFE2A6" stopOpacity=".7"/><stop offset=".22" stopColor="#EBC179" stopOpacity=".13"/><stop offset="1" stopColor="#DCA258" stopOpacity="0"/></radialGradient>
      <filter id="star-blur"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <circle cx="300" cy="300" r="300" fill="url(#nebula)"/>
    {Array.from({ length: 175 }, (_, i) => {
      const x = ((i * 127.7 + i * i * 3.1) % 540) + 10;
      const y = ((i * 83.3 + i * i * 1.7) % 600) + 10;
      return <circle key={i} cx={x} cy={y} r={i % 19 === 0 ? 1.7 : i % 4 === 0 ? 1 : .55} fill={i % 3 ? '#EFE6CA' : '#B9CCC4'} opacity={.2 + (i % 7) / 10} className={i % 19 === 0 ? 'twinkle' : undefined} style={{ animationDelay: `${i % 7}s` }}/>;
    })}
    <g stroke="#DAC292" strokeWidth=".55" opacity=".33">
      <circle cx="285" cy="303" r="211"/><circle cx="285" cy="303" r="165" strokeDasharray="2 7"/>
      <ellipse cx="285" cy="303" rx="211" ry="74" transform="rotate(-37 285 303)"/>
      <ellipse cx="285" cy="303" rx="211" ry="74" transform="rotate(51 285 303)"/>
      <path d="M74 303H496M285 92V514" strokeDasharray="2 6"/>
    </g>
    <g stroke="#D9C59F" strokeWidth=".75" opacity=".5"><path d="m163 345 48-94 88 26 42-95 90 58-30 106-102-69-64 116-72-48Z"/><path d="m341 182-56-56"/></g>
    {[ [163,345], [211,251], [341,182], [431,240], [401,346], [235,393], [285,126] ].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="2.3" fill="#F2D8A8"/><circle cx={x} cy={y} r="6" stroke="#F2D8A8" strokeWidth=".5" opacity=".4"/></g>)}
    <circle cx="299" cy="277" r="90" fill="url(#gold-glow)"/>
    <path d="M299 251C301 272 304 275 325 277C304 279 301 282 299 303C297 282 294 279 273 277C294 275 297 272 299 251Z" fill="#FFE8B7"/>
    <circle cx="299" cy="277" r="5" fill="#FFF1CA" filter="url(#star-blur)"/>
    <g fill="#DBCEAF" fontFamily="monospace" fontSize="8" letterSpacing="2"><text x="276" y="77">N</text><text x="278" y="539">S</text><text x="47" y="307">W</text><text x="513" y="307">E</text></g>
    <g stroke="#D9C59F" strokeWidth=".5" opacity=".5">{Array.from({length:60},(_,i)=><path key={i} d={i%5===0?'M285 84V94':'M285 88V93'} transform={`rotate(${i*6} 285 303)`}/>)}</g>
  </svg>;
}
