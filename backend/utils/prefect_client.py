import asyncio
from prefect.client import get_client


async def fetch_pipeline_data(flow_name: str):
    async with get_client() as client:
        flows = await client.read_flows()
        flow = next((f for f in flows if f.name == flow_name), None)
        if not flow:
            return None

        flow_runs = await client.read_flow_runs(flow_filter={"id": {"any_": [flow.id]}})
        if not flow_runs:
            return None

        latest_run = sorted(flow_runs, key=lambda r: r.created, reverse=True)[0]
        task_runs = await client.read_task_runs(flow_run_filter={"id": {"any_": [latest_run.id]}})

        result = {
            "flow_name": flow.name,
            "start_time": latest_run.start_time,
            "end_time": latest_run.end_time,
            "state": latest_run.state.name,
            "task_runs": [
                {
                    "id": tr.id,
                    "name": tr.name,
                    "state": tr.state.name,
                    "start_time": tr.start_time,
                    "end_time": tr.end_time,
                    "duration": (tr.end_time - tr.start_time).total_seconds() if tr.start_time and tr.end_time else None,
                    "message": tr.state.message if hasattr(tr.state, "message") else ""
                }
                for tr in task_runs
            ]
        }

        return result


def get_pipeline_data(flow_name: str):
    return asyncio.run(fetch_pipeline_data(flow_name))