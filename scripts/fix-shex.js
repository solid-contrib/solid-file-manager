#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const shexPath = path.join(__dirname, '../src/shapes/Model.shex');

if (!fs.existsSync(shexPath)) {
  console.error('Model.shex not found');
  process.exit(1);
}

let shex = fs.readFileSync(shexPath, 'utf8');

// Fix 1: Replace full file paths with # references
shex = shex.replace(/file:\/\/\/[^#]+#/g, '#');
shex = shex.replace(/<file:\/\/\/[^>]+>/g, (match) => {
  const shapeName = match.split('#').pop().replace('>', '');
  return `<#${shapeName}>`;
});

// Fix 2: Add back the value enumeration for acp:allow
if (shex.includes('acp:allow IRI {1,1}')) {
  shex = shex.replace('acp:allow IRI {1,1}', 'acp:allow [ acp:Read acp:Write ] {1,1}');
}

// Fix 3: Fix the anyOf reference to use proper shape reference
shex = shex.replace(/acp:anyOf \{[\s\S]*?a \[<#[^>]+>\]\}/g, (match) => {
  const shapeMatch = match.match(/<#([^>]+)>/);
  if (shapeMatch) {
    return `acp:anyOf @<#${shapeMatch[1]}>{1,1}`;
  }
  return match;
});

// Fix 4: Fix agentGroup and public references
shex = shex.replace(/acp:agentGroup \{[\s\S]*?a \[<#[^>]+>\]\}/g, (match) => {
  const shapeMatch = match.match(/<#([^>]+)>/);
  if (shapeMatch) {
    return `acp:agentGroup @<#${shapeMatch[1]}>*`;
  }
  return match;
});

shex = shex.replace(/acp:public \{[\s\S]*?a \[<#[^>]+>\]\}/g, (match) => {
  const shapeMatch = match.match(/<#([^>]+)>/);
  if (shapeMatch) {
    return `acp:public @<#${shapeMatch[1]}>?`;
  }
  return match;
});

// Fix 5: Add missing shapes if they don't exist
if (!shex.includes('<#AgentGroupShape>')) {
  shex += '\n\n<#AgentGroupShape> {\n    rdf:type [ acp:AgentGroup ] ;\n}\n';
}

if (!shex.includes('<#PublicShape>')) {
  shex += '\n<#PublicShape> {\n    rdf:type [ acp:Public ] ;\n}\n';
}

// Fix 6: Clean up prefixes - keep only what we need
const prefixSection = `PREFIX acp: <http://www.w3.org/ns/solid/acp#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

`;

shex = shex.replace(/PREFIX[^\n]+\n/g, '');
shex = prefixSection + shex;

// Fix 7: Add rdf:type declarations where needed
const shapes = ['AccessControlResourceShape', 'AccessControlShape', 'PolicyShape', 'MatcherShape'];
shapes.forEach(shapeName => {
  const shapePattern = new RegExp(`<#${shapeName}>\\s*\\{`, 'g');
  if (shex.match(shapePattern) && !shex.includes(`<#${shapeName}> {`)) {
    const typeMap = {
      'AccessControlResourceShape': 'acp:AccessControlResource',
      'AccessControlShape': 'acp:AccessControl',
      'PolicyShape': 'acp:Policy',
      'MatcherShape': 'acp:Matcher'
    };
    const type = typeMap[shapeName];
    if (type) {
      shex = shex.replace(
        new RegExp(`<#${shapeName}>\\s*\\{`),
        `<#${shapeName}> {\n    rdf:type [ ${type} ] ;`
      );
    }
  }
});

// Write the final cleaned up version
const finalShex = `PREFIX acp: <http://www.w3.org/ns/solid/acp#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

<#AccessControlResourceShape> {
    rdf:type [ acp:AccessControlResource ] ;
    acp:resource IRI {1,1} ;
    acp:accessControl @<#AccessControlShape> {1,*} ;
}

<#AccessControlShape> {
    rdf:type [ acp:AccessControl ] ;
    acp:apply @<#PolicyShape> {1,1} ;
}

<#PolicyShape> {
    rdf:type [ acp:Policy ] ;
    acp:allow [ acp:Read acp:Write ] {1,1} ;
    acp:anyOf @<#MatcherShape> {1,1} ;
    acp:agentGroup @<#AgentGroupShape> {0,*} ;
    acp:public @<#PublicShape> {0,1} ;
}

<#MatcherShape> {
    rdf:type [ acp:Matcher ] ;
    acp:agent IRI ;
}

<#AgentGroupShape> {
    rdf:type [ acp:AgentGroup ] ;
}

<#PublicShape> {
    rdf:type [ acp:Public ] ;
}
`;

fs.writeFileSync(shexPath, finalShex);
console.log('Fixed Model.shex');

