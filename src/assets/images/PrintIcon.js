import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Ported from UNIGS_COLLECTION/app/src/main/res/drawable/ic_print.xml.
const PrintIcon = ({ size = 44 }) => (
  <Svg width={size} height={size} viewBox="0 0 1024 1024">
    <Path d="M192 234.7h640v64H192z" fill="#424242" />
    <Path d="M85.3 533.3h853.3V384c0-46.9-38.4-85.3-85.3-85.3H170.7C123.8 298.7 85.3 337.1 85.3 384v149.3z" fill="#616161" />
    <Path d="M170.7 768h682.7c46.9 0 85.3-38.4 85.3-85.3V512H85.3v170.7c0 46.9 38.5 85.3 85.4 85.3z" fill="#424242" />
    <Path d="M853.3 362.7a21.3 21.3 0 1 1 0 42.6 21.3 21.3 0 0 1 0-42.6z" fill="#00E676" />
    <Path d="M234.7 85.3h554.7v213.3H234.7z" fill="#90CAF9" />
    <Path d="M800 661.3H224c-17.1 0-32-14.9-32-32s14.9-32 32-32h576c17.1 0 32 14.9 32 32s-14.9 32-32 32z" fill="#242424" />
    <Path d="M234.7 661.3h554.7V896H234.7z" fill="#90CAF9" />
    <Path d="M234.7 618.7h554.7v42.7H234.7z" fill="#42A5F5" />
    <Path d="M341.3 704H704v42.7H341.3zm0 85.3h277.3V832H341.3z" fill="#1976D2" />
  </Svg>
);

export default PrintIcon;
