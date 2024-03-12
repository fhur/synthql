import { Path } from '../../execution/types';
import { isObj } from '../isObj';

export function assertObject(
    obj: unknown,
    path: Path,
): asserts obj is { [k: string]: unknown } {
    if (!isObj(obj)) {
        throw new Error(`Expected an object at path: ${JSON.stringify(path)}`);
    }
}
