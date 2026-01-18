import CodeSnippet from '@/app/components/CodeSnippet';
import Link from 'next/link';

export default function MyComponent() {
  return (
    <div>
      <Link       import CodeSnippet from '@/app/components/CodeSnippet';
      import Link from 'next/link';
      
      function Navigation() {
        return (
          <div>
            <Link href="/">Home</Link>
            <Link href="/examples">Examples</Link>
          </div>
        );
      }
      
      export default function CodeExample() {
        // ... rest of your code
      }href="/">Home</Link>
      <Link href="/examples">Examples</Link>
    </div>
  );
}

export default function CodeExample() {
  const pythonCode = `
import bpy

def create_cube():
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0))
    obj = bpy.context.active_object
    return obj

def rotate_object(obj, rotation):
    obj.rotation_euler = rotation
    bpy.context.view_layer.update()

cube = create_cube()
rotate_object(cube, (0.5, 0.5, 0))
`;

  const blenderCode = `
# Simple material assignment
import bpy

mat = bpy.data.materials.new(name="GreenMaterial")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs[0].default_value = (0.1, 0.8, 0.2, 1.0)

obj = bpy.context.active_object
obj.data.materials.append(mat)
`;

  return (
    <main style={{ padding: '40px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Code Snippet Display Examples</h1>

      <h2>Example 1: Create and Rotate Cube</h2>
      <CodeSnippet
        code={pythonCode}
        language="python"
        title="create_and_rotate.py"
        showLineNumbers={true}
      />

      <h2>Example 2: Material Assignment</h2>
      <CodeSnippet
        code={blenderCode}
        language="python"
        title="assign_material.py"
        showLineNumbers={true}
      />
    </main>
  );
}
