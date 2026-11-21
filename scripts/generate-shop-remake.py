"""Execute the approved shop v2 plan; resume successes, never retry a paid task.

No task is submitted without --approved-credits matching the saved estimate.
Logs and receipts stay in assets/shop/remake-v2/. No secrets are printed.
"""
import argparse
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / 'assets/shop/remake-plan.json'
OUT = ROOT / 'assets/shop/remake-v2'
LOCK = threading.Lock()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--approved-credits', type=int, required=True)
    parser.add_argument('--concurrency', type=int, default=3, choices=range(1, 6))
    args = parser.parse_args()
    plan = json.loads(PLAN.read_text())
    if args.approved_credits != plan['estimatedTotal']:
        raise SystemExit('Budget does not match the reviewed plan.')
    OUT.mkdir(parents=True, exist_ok=True)
    report_path = OUT / 'generation-report.json'
    report = json.loads(report_path.read_text()) if report_path.exists() else {'approvedCredits': args.approved_credits, 'jobs': {}}
    environment = {**os.environ, 'TRIPO_CLIENT_APP': 'codex', 'TRIPO_DISTRIBUTION_CHANNEL': 'codex_plugin'}
    def save():
        temp = report_path.with_suffix('.tmp')
        temp.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        temp.replace(report_path)
    def run(job):
        ident = job['id']
        with LOCK:
            previous = report['jobs'].get(ident)
            if previous:
                print(json.dumps({'id': ident, 'status': 'skipped-existing', 'previousStatus': previous['status']}), flush=True)
                return
            report['jobs'][ident] = {'status': 'running', 'startedAt': time.time(), 'destination': job['destination']}
            save()
        print(json.dumps({'id': ident, 'status': 'starting', 'estimatedCredits': 40}), flush=True)
        with (OUT / (ident + '.stdout.json')).open('w') as stdout, (OUT / (ident + '.stderr.log')).open('w') as stderr:
            result = subprocess.run(job['command'], cwd=ROOT, env=environment, stdout=stdout, stderr=stderr)
        record = {'status': 'failed', 'exitCode': result.returncode, 'completedAt': time.time(), 'destination': job['destination']}
        if result.returncode == 0:
            try:
                payload = json.loads((OUT / (ident + '.stdout.json')).read_text())
                record.update(status=payload.get('status', 'success'), result=payload)
            except Exception as error:
                record['error'] = str(error)
        with LOCK:
            report['jobs'][ident].update(record)
            save()
        print(json.dumps({'id': ident, 'status': record['status'], 'task_id': record.get('result', {}).get('task_id'), 'credits': record.get('result', {}).get('credits_consumed')}), flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        list(pool.map(run, plan['jobs']))
    success = sum(j['status'] == 'success' for j in report['jobs'].values())
    print(json.dumps({'finished': True, 'success': success, 'total': len(plan['jobs'])}), flush=True)
    raise SystemExit(0 if success == len(plan['jobs']) else 1)

if __name__ == '__main__':
    main()
