#!/usr/bin/env node

/**
 * This script generates the missing LDO files (context, schema, shapeTypes) 
 * that the LDO CLI should be generating but isn't due to a bug in the alpha version.
 * 
 * This uses the same approach the LDO CLI uses internally.
 */

const fs = require('fs');
const path = require('path');
const parser = require('@shexjs/parser');

const shapesDir = path.join(__dirname, '../src/shapes');
const outputDir = path.join(__dirname, '../src/ldo');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Find all .shex files
const shexFiles = fs.readdirSync(shapesDir)
  .filter(file => file.endsWith('.shex'))
  .map(file => ({
    fileName: path.basename(file, '.shex'),
    filePath: path.join(shapesDir, file)
  }));

for (const { fileName, filePath } of shexFiles) {
  console.log(`Processing ${fileName}...`);
  
  const shexC = fs.readFileSync(filePath, 'utf8');
  
  // Parse ShEx
  let schema;
  try {
    schema = parser.construct('https://ldo.js.org/').parse(shexC);
  } catch (err) {
    console.error(`Error parsing ${fileName}:`, err.message);
    continue;
  }
  
  // Extract shape names from the schema
  // Shapes are in an array, each with an id property
  const shapeNames = (schema.shapes || [])
    .map(shape => shape.id)
    .filter(id => id) // Filter out undefined
    .map(id => {
      // Extract the shape name from the full URL (e.g., "https://ldo.js.org/#AccessControlResourceShape" -> "#AccessControlResourceShape")
      const match = id.match(/#[^#]+$/);
      return match ? match[0] : id;
    });
  
  // Generate context.ts - minimal JSON-LD context
  const context = {
    "@context": {
      "acp": "http://www.w3.org/ns/solid/acp#",
      "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      "AccessControlResource": "acp:AccessControlResource",
      "AccessControl": "acp:AccessControl",
      "Policy": "acp:Policy",
      "Matcher": "acp:Matcher",
      "AgentGroup": "acp:AgentGroup",
      "Public": "acp:Public",
      "resource": "acp:resource",
      "accessControl": "acp:accessControl",
      "apply": "acp:apply",
      "allow": "acp:allow",
      "anyOf": "acp:anyOf",
      "agent": "acp:agent",
      "agentGroup": "acp:agentGroup",
      "public": "acp:public",
      "Read": "acp:Read",
      "Write": "acp:Write"
    }
  };
  
  const contextContent = `/**
 * =============================================================================
 * JSON-LD Context for ${fileName}
 * =============================================================================
 * 
 * This file is auto-generated. Do not edit manually.
 */

export const ${fileName}Context = ${JSON.stringify(context, null, 2)};
`;
  
  // Generate schema.ts
  const schemaContent = `/**
 * =============================================================================
 * Schema for ${fileName}
 * =============================================================================
 * 
 * This file is auto-generated. Do not edit manually.
 */

import type { Schema } from "shexj";

export const ${fileName}Schema: Schema = ${JSON.stringify(schema, null, 2)};
`;
  
  // Generate shapeTypes.ts
  // Map shape IDs to TypeScript type names from the typings file
  const shapeTypeMap = {
    '#AccessControlResourceShape': 'AccessControlResource',
    '#AccessControlShape': 'AccessControl',
    '#PolicyShape': 'Policy',
    '#MatcherShape': 'Matcher',
    '#AgentGroupShape': 'any', // These don't have types in typings
    '#PublicShape': 'any'
  };
  
  const shapeTypeImports = shapeNames
    .filter(shapeName => shapeTypeMap[shapeName] && shapeTypeMap[shapeName] !== 'any')
    .map(shapeName => {
      const typeName = shapeTypeMap[shapeName];
      return `import type { ${typeName} } from "./${fileName}.typings";`;
    })
    .join('\n');
  
  const shapeTypeExports = shapeNames
    .map(shapeName => {
      const typeName = shapeTypeMap[shapeName] || 'any';
      // Remove the # prefix to get the shape ID (e.g., "#AccessControlResourceShape" -> "AccessControlResourceShape")
      // The export name should be the shape ID + "Type" (e.g., "AccessControlResourceShapeType")
      // Since the shape ID already ends with "Shape", we just add "Type" to it
      const shapeId = shapeName.replace(/^#/, '');
      return `export const ${shapeId}Type: ShapeType<${typeName} & LdoBase> = {
  schema: ${fileName}Schema,
  shape: "${shapeName}",
  context: ${fileName}Context["@context"],
};`;
    })
    .join('\n\n');
  
  const shapeTypesContent = `/**
 * =============================================================================
 * Shape Types for ${fileName}
 * =============================================================================
 * 
 * This file is auto-generated. Do not edit manually.
 */

import { ShapeType, LdoBase } from "@ldo/ldo";
import { ${fileName}Context } from "./${fileName}.context";
import { ${fileName}Schema } from "./${fileName}.schema";
${shapeTypeImports}

${shapeTypeExports}
`;
  
    // Write files - always overwrite to ensure they're not empty
    const contextPath = path.join(outputDir, `${fileName}.context.ts`);
    const schemaPath = path.join(outputDir, `${fileName}.schema.ts`);
    const shapeTypesPath = path.join(outputDir, `${fileName}.shapeTypes.ts`);
    
    // Check if files exist and are empty - if so, delete them to force regeneration
    [contextPath, schemaPath, shapeTypesPath].forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          console.log(`⚠️  Deleting empty file: ${filePath}`);
          fs.unlinkSync(filePath);
        }
      }
    });
    
    try {
      fs.writeFileSync(contextPath, contextContent, 'utf8');
      fs.writeFileSync(schemaPath, schemaContent, 'utf8');
      fs.writeFileSync(shapeTypesPath, shapeTypesContent, 'utf8');
      
      // Verify files were written correctly
      const contextSize = fs.statSync(contextPath).size;
      const schemaSize = fs.statSync(schemaPath).size;
      const shapeTypesSize = fs.statSync(shapeTypesPath).size;
      
      if (contextSize === 0 || schemaSize === 0 || shapeTypesSize === 0) {
        console.error(`Warning: One or more files for ${fileName} are empty!`);
        console.error(`Context: ${contextSize} bytes, Schema: ${schemaSize} bytes, ShapeTypes: ${shapeTypesSize} bytes`);
        process.exit(1);
      } else {
        console.log(`Generated files for ${fileName} (${contextSize + schemaSize + shapeTypesSize} bytes total)`);
      }
    } catch (error) {
      console.error(`Error writing files for ${fileName}:`, error.message);
      process.exit(1);
    }
  
}

