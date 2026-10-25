from pyvis.network import Network


def format_duration(seconds):
    if not seconds:
        return "-"
    mins, secs = divmod(int(seconds), 60)
    return f"{mins}m {secs}s"

def build_graph(pipeline_data, edges=None):
    net = Network(height="500px", directed=True, bgcolor="#1e1e1e", font_color="white")

    color_map = {
        "COMPLETED": "green",
        "RUNNING": "orange",
        "FAILED": "red",
        "PENDING": "gray"
    }

    task_runs = pipeline_data["task_runs"]
    for task in task_runs:
        label = task.get('label', task.get('name'))
        node_id = task.get('id', task.get('name'))
        duration = format_duration(task.get("duration"))
        hover = f"Status: {task.get('state')}<br>Duração: {duration}<br>Mensagem: {task.get('message','')}"
        color = color_map.get(str(task.get("state", "")).upper(), "gray")
        net.add_node(node_id, label=label, color=color, title=hover)

    # Arestas informadas pela API/DAG
    if edges:
        for src, dst in edges:
            # Edges refer to node ids (names in this graph)
            net.add_edge(src, dst)

    net.set_options("""
    var options = {
      nodes: {
        shape: 'box',
        font: { size: 14, face: 'arial' }
      },
      edges: {
        arrows: {
          to: {enabled: true}
        },
        color: "#AAAAAA"
      },
      physics: {
        enabled: false
      }
    }
    """)
    
    return net