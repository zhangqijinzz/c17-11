import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('keeps completed state while browsing and only real edits enter editing', () => {
    const storage = new MemoryStorageService();
    let writes = 0;
    const countingStorage = {
      read: () => storage.read(),
      write: (value: string) => { writes += 1; storage.write(value); },
    };
    const viewModel = new StoryViewModel(new LocalStoryRepository(countingStorage));
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');

    // 纯浏览：点开任意一幕，不进入编辑中，也不产生保存
    const sceneIds = viewModel.snapshot.story?.scenes.map((scene) => scene.id) ?? [];
    viewModel.selectScene(sceneIds[1] ?? '');
    expect(viewModel.selectedScene?.id).toBe(sceneIds[1]);
    expect(viewModel.snapshot.status).toBe('ready');
    expect(writes).toBe(0);

    // 标记完成后浏览，完成状态不丢、按钮不回退、不保存
    viewModel.completeProject();
    expect(viewModel.snapshot.status).toBe('completed');
    const writesAfterComplete = writes;
    sceneIds.forEach((sceneId) => viewModel.selectScene(sceneId));
    expect(viewModel.snapshot.status).toBe('completed');
    expect(writes).toBe(writesAfterComplete);

    // 真正改内容才进入编辑中，并保存一次
    viewModel.updateScene(sceneIds[0] ?? '', { conflict: '她必须在涨潮前做出选择。' });
    expect(viewModel.snapshot.status).toBe('editing');
    expect(writes).toBe(writesAfterComplete + 1);
  });
});
