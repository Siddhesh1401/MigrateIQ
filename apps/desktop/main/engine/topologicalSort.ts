/**
 * Topological Sort Engine (Phase 9)
 * 
 * Determines the safe order to create tables and insert data so that foreign key
 * constraints don't fail. Uses Kahn's Algorithm for DAG topological sorting.
 * 
 * Key Challenge: Handle circular foreign key dependencies (e.g., users ↔ organizations)
 * by deferring FK constraint creation until after all data is loaded.
 */

import { CollectionMapping, TopologicalSortResult } from '@migrateiq/shared';

interface TableNode {
  tableName: string;
  dependencies: Set<string>; // Tables this table depends on (via FK)
  dependents: Set<string>;   // Tables that depend on this table
}

interface ForeignKeyConstraint {
  tableName: string;
  constraintName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: string;
  onUpdate: string;
}

/**
 * Performs topological sort on tables based on foreign key dependencies.
 * Returns the safe order to create/populate tables, handling circular dependencies.
 */
export function topologicalSort(mappings: CollectionMapping[]): TopologicalSortResult {
  try {
    // Step 1: Build dependency graph
    const graph = buildDependencyGraph(mappings);
    
    // Step 2: Detect circular dependencies using DFS cycle detection
    const cycles = detectCycles(graph);
    
    // Step 3: If cycles exist, extract FKs that participate in cycles
    const deferredConstraints: ForeignKeyConstraint[] = [];
    if (cycles.length > 0) {
      // Remove edges that form cycles (we'll add them as deferred constraints)
      const cycleEdges = extractCycleEdges(cycles, mappings);
      deferredConstraints.push(...cycleEdges);
      
      // Rebuild graph without cycle edges
      for (const constraint of deferredConstraints) {
        const node = graph.get(constraint.tableName);
        if (node) {
          node.dependencies.delete(constraint.referencedTable);
        }
        const refNode = graph.get(constraint.referencedTable);
        if (refNode) {
          refNode.dependents.delete(constraint.tableName);
        }
      }
    }
    
    // Step 4: Perform Kahn's algorithm for topological ordering
    const orderedTables = kahnsAlgorithm(graph);
    
    // Step 5: Verify all tables are ordered (no remaining cycles)
    const allTables = Array.from(graph.keys());
    if (orderedTables.length !== allTables.length) {
      return {
        success: false,
        orderedTables: [],
        cycles: cycles.length > 0 ? cycles.map(cycle => ({
          tables: cycle,
          foreignKeys: []
        })) : undefined,
        error: `Topological sort failed: ${allTables.length - orderedTables.length} tables have unresolved dependencies`
      };
    }
    
    return {
      success: true,
      orderedTables,
      cycles: cycles.length > 0 ? cycles.map(cycle => ({
        tables: cycle,
        foreignKeys: deferredConstraints
          .filter(fk => cycle.includes(fk.tableName))
          .map(fk => `${fk.tableName}.${fk.columnName} → ${fk.referencedTable}.${fk.referencedColumn}`)
      })) : undefined
    };
  } catch (error) {
    return {
      success: false,
      orderedTables: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Builds a directed graph of table dependencies based on foreign keys.
 */
function buildDependencyGraph(mappings: CollectionMapping[]): Map<string, TableNode> {
  const graph = new Map<string, TableNode>();
  
  // Initialize all tables as nodes
  for (const collection of mappings) {
    const tableName = collection.targetTableName || collection.collectionName;
    if (!graph.has(tableName)) {
      graph.set(tableName, {
        tableName,
        dependencies: new Set(),
        dependents: new Set()
      });
    }
    
    // Process child tables
    if (collection.childTables) {
      for (const child of collection.childTables) {
        const childTableName = child.targetTableName || child.collectionName;
        if (!graph.has(childTableName)) {
          graph.set(childTableName, {
            tableName: childTableName,
            dependencies: new Set(),
            dependents: new Set()
          });
        }
        
        // Child table depends on parent table
        graph.get(childTableName)!.dependencies.add(tableName);
        graph.get(tableName)!.dependents.add(childTableName);
      }
    }
  }
  
  // Add foreign key dependencies
  for (const collection of mappings) {
    const tableName = collection.targetTableName || collection.collectionName;
    
    for (const field of collection.fields) {
      if (field.foreignKeyToParent) {
        // Extract referenced table name (format: "table_name.column_name" or just "table_name")
        const referencedTable = field.foreignKeyToParent.split('.')[0];
        
        if (referencedTable && referencedTable !== tableName) {
          // Ensure referenced table exists in graph
          if (!graph.has(referencedTable)) {
            graph.set(referencedTable, {
              tableName: referencedTable,
              dependencies: new Set(),
              dependents: new Set()
            });
          }
          
          // This table depends on the referenced table
          graph.get(tableName)!.dependencies.add(referencedTable);
          graph.get(referencedTable)!.dependents.add(tableName);
        }
      }
    }
    
    // Process child table fields for FKs
    if (collection.childTables) {
      for (const child of collection.childTables) {
        const childTableName = child.targetTableName || child.collectionName;
        
        for (const field of child.fields) {
          if (field.foreignKeyToParent) {
            const referencedTable = field.foreignKeyToParent.split('.')[0];
            
            if (referencedTable && referencedTable !== childTableName) {
              if (!graph.has(referencedTable)) {
                graph.set(referencedTable, {
                  tableName: referencedTable,
                  dependencies: new Set(),
                  dependents: new Set()
                });
              }
              
              graph.get(childTableName)!.dependencies.add(referencedTable);
              graph.get(referencedTable)!.dependents.add(childTableName);
            }
          }
        }
      }
    }
  }
  
  return graph;
}

/**
 * Detects circular dependencies using Depth-First Search (DFS).
 * Returns arrays of table names that form cycles.
 */
function detectCycles(graph: Map<string, TableNode>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const currentPath: string[] = [];
  
  function dfs(tableName: string): boolean {
    visited.add(tableName);
    recursionStack.add(tableName);
    currentPath.push(tableName);
    
    const node = graph.get(tableName);
    if (!node) return false;
    
    for (const dependency of node.dependencies) {
      if (!visited.has(dependency)) {
        if (dfs(dependency)) {
          return true;
        }
      } else if (recursionStack.has(dependency)) {
        // Cycle detected! Extract the cycle from currentPath
        const cycleStartIndex = currentPath.indexOf(dependency);
        const cycle = currentPath.slice(cycleStartIndex);
        
        // Only add if not already detected (avoid duplicates)
        const cycleKey = [...cycle].sort().join(',');
        const existingCycleKey = cycles.map(c => [...c].sort().join(',')).find(k => k === cycleKey);
        if (!existingCycleKey) {
          cycles.push(cycle);
        }
        
        return true;
      }
    }
    
    recursionStack.delete(tableName);
    currentPath.pop();
    return false;
  }
  
  // Run DFS from each unvisited node
  for (const tableName of graph.keys()) {
    if (!visited.has(tableName)) {
      dfs(tableName);
    }
  }
  
  return cycles;
}

/**
 * Extracts foreign key constraints that participate in circular dependencies.
 * These constraints will be added AFTER data is loaded using ALTER TABLE.
 */
function extractCycleEdges(cycles: string[][], mappings: CollectionMapping[]): ForeignKeyConstraint[] {
  const deferredConstraints: ForeignKeyConstraint[] = [];
  const cycleTablesSet = new Set(cycles.flat());
  
  for (const collection of mappings) {
    const tableName = collection.targetTableName || collection.collectionName;
    
    if (!cycleTablesSet.has(tableName)) continue;
    
    for (const field of collection.fields) {
      if (field.foreignKeyToParent) {
        const referencedTable = field.foreignKeyToParent.split('.')[0];
        const referencedColumn = field.foreignKeyToParent.split('.')[1] || 'id';
        
        // Check if this FK participates in a cycle
        const participatesInCycle = cycles.some(cycle => 
          cycle.includes(tableName) && cycle.includes(referencedTable)
        );
        
        if (participatesInCycle) {
          deferredConstraints.push({
            tableName,
            constraintName: `fk_${tableName}_${field.targetField}`,
            columnName: field.targetField,
            referencedTable,
            referencedColumn,
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
          });
        }
      }
    }
    
    // Process child tables
    if (collection.childTables) {
      for (const child of collection.childTables) {
        const childTableName = child.targetTableName || child.collectionName;
        
        if (!cycleTablesSet.has(childTableName)) continue;
        
        for (const field of child.fields) {
          if (field.foreignKeyToParent) {
            const referencedTable = field.foreignKeyToParent.split('.')[0];
            const referencedColumn = field.foreignKeyToParent.split('.')[1] || 'id';
            
            const participatesInCycle = cycles.some(cycle => 
              cycle.includes(childTableName) && cycle.includes(referencedTable)
            );
            
            if (participatesInCycle) {
              deferredConstraints.push({
                tableName: childTableName,
                constraintName: `fk_${childTableName}_${field.targetField}`,
                columnName: field.targetField,
                referencedTable,
                referencedColumn,
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
              });
            }
          }
        }
      }
    }
  }
  
  return deferredConstraints;
}

/**
 * Kahn's Algorithm for topological sorting.
 * Returns tables in safe creation order (tables with no dependencies first).
 */
function kahnsAlgorithm(graph: Map<string, TableNode>): string[] {
  const sorted: string[] = [];
  const inDegree = new Map<string, number>();
  
  // Calculate in-degree for each node (number of dependencies)
  for (const [tableName, node] of graph.entries()) {
    inDegree.set(tableName, node.dependencies.size);
  }
  
  // Queue of tables with no dependencies (in-degree = 0)
  const queue: string[] = [];
  for (const [tableName, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(tableName);
    }
  }
  
  // Process queue
  while (queue.length > 0) {
    const tableName = queue.shift()!;
    sorted.push(tableName);
    
    const node = graph.get(tableName);
    if (!node) continue;
    
    // Decrease in-degree of dependent tables
    for (const dependent of node.dependents) {
      const currentDegree = inDegree.get(dependent) || 0;
      const newDegree = currentDegree - 1;
      inDegree.set(dependent, newDegree);
      
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }
  
  return sorted;
}

/**
 * Generates SQL statements to add deferred foreign key constraints.
 * Used for circular FK dependencies.
 */
export function generateDeferredConstraintsSql(constraints: ForeignKeyConstraint[]): string[] {
  return constraints.map(fk => {
    // Use NOT VALID to add constraint without locking table for full scan
    // Then VALIDATE CONSTRAINT to check data integrity
    return `ALTER TABLE ${fk.tableName} ADD CONSTRAINT ${fk.constraintName} FOREIGN KEY (${fk.columnName}) REFERENCES ${fk.referencedTable}(${fk.referencedColumn}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate} NOT VALID;\nALTER TABLE ${fk.tableName} VALIDATE CONSTRAINT ${fk.constraintName};`;
  });
}
