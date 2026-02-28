// scripts/generate-openapi.ts
import { writeFileSync } from 'fs'
import { join } from 'path'
import yaml from 'yaml'
import { generateOpenApiDocument } from '../src/api/openapi'

const outputPath = join(process.cwd(), 'openapi.yaml')

try {
  const doc = generateOpenApiDocument()
  const yamlContent = yaml.stringify(doc)
  writeFileSync(outputPath, yamlContent, 'utf-8')
  console.log(`OpenAPI spec written to ${outputPath}`)
} catch (error) {
  console.error('Failed to generate OpenAPI spec:', error)
  process.exit(1)
}
