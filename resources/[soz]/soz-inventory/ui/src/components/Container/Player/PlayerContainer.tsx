import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debugPlayerInventory } from '../../../test/debug';
import { InventoryItem, SozInventoryModel } from '../../../types/inventory';
import { ContainerWrapper } from '../ContainerWrapper';
import style from './PlayerContainer.module.css';
import { ContainerSlots } from '../ContainerSlots';
import playerBanner from '/banner/player.jpg'
import { closeNUI } from '../../../hooks/nui';
import { clsx } from 'clsx';
import { DndContext, rectIntersection } from '@dnd-kit/core';
import { useInventoryRow } from '../../../hooks/useInventoryRow';
import { handleSortInventory } from '../../../hooks/handleSortInventory';

export const PlayerContainer = () => {
    const [display, setDisplay] = useState<boolean>(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const [playerMoney, setPlayerMoney] = useState<number>(0);
    const [playerInventory, setPlayerInventory] = useState<SozInventoryModel | null>();
    const [playerShortcuts, setPlayerShortcuts] = useState<Partial<InventoryItem>[]>();

    const interactAction = useCallback(
        (action: string, item: InventoryItem, shortcut: number) => {
            fetch(`https://soz-inventory/player/${action}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=UTF-8",
                },
                body: JSON.stringify({ ...item, shortcut }),
            }).then(() => {
                setDisplay(false);
            });
        },
        [setDisplay]
    );

    const onClickReceived = useCallback(
        (event: MouseEvent) => {
            if (display && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                event.preventDefault();
                closeNUI(() => setDisplay(false));
            }
        },
        [menuRef, display, setDisplay]
    );

    const onMessageReceived = useCallback(
        (event: MessageEvent) => {
            if (event.data.action === "openPlayerInventory") {
                if (event.data.playerInventory === undefined) return;

                try {
                    if (typeof event.data.playerInventory === "object") {
                        event.data.playerInventory.items = Object.values(event.data.playerInventory.items);
                    }

                    event.data.playerInventory.items = event.data.playerInventory.items.filter((i: InventoryItem) => i !== null)

                    setPlayerInventory(event.data.playerInventory);
                    setPlayerMoney(event.data.playerMoney);
                    setPlayerShortcuts(event.data.playerShortcuts);

                    setDisplay(true);
                } catch (e: any) {
                    console.error(e, event.data.playerInventory, event.data.playerMoney);
                    closeNUI(() => setDisplay(false));
                }
            }
        },
        [setDisplay, setPlayerMoney, setPlayerInventory, setPlayerShortcuts]
    );

    const onKeyDownReceived = useCallback(
        (event: KeyboardEvent) => {
            if (display && !event.repeat && (event.key === "Escape" || event.key === "F2")) {
                closeNUI(() => setDisplay(false));
            }
        },
        [display, setDisplay]
    );

    const handleDragAndDrop = useCallback((event: any) => {
            if (!event.active.data.current) return;

            if (event.over !== null) { // Do a sort in inventory
                fetch(`https://soz-inventory/sortItem`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=UTF-8",
                    },
                    body: JSON.stringify({
                        item: event.active.data.current.item,
                        slot: event.over.data.current.slot,
                        inventory: playerInventory?.id,
                    }),
                })
                    .then(res => res.json())
                    .then((transfer) => {
                        if (typeof transfer.sourceInventory === "object") {
                            transfer.sourceInventory.items = Object.values(transfer.sourceInventory.items);
                        }

                        transfer.sourceInventory.items = transfer.sourceInventory.items.filter((i: InventoryItem) => i !== null)
                        setPlayerInventory(transfer.sourceInventory);
                    })
                    .catch((e) => {
                    console.error("Failed to sort item", e);
                });
            } else {
                fetch(`https://soz-inventory/player/giveItemToTarget`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=UTF-8",
                    },
                    body: JSON.stringify(event.active.data.current.item),
                }).then(() => {
                    setDisplay(false);
                });
            }
        },
        [playerInventory, setDisplay]
    );

    const itemShortcut = useCallback((item: InventoryItem) => {
        if (!item) return null;

        const shortcut = Object.entries(playerShortcuts || {})?.find(([id, s]) => {
            if (s === null) return false;

            const itemMetadata = Object.values(item.metadata || {})
            const shortcutMetadata = Object.values(s?.metadata || {})

            return s.name === item.name && shortcutMetadata.every(m => itemMetadata.includes(m));
        });

        return shortcut ? shortcut[0] : null;
    }, [playerShortcuts]);

    useEffect(() => {
        window.addEventListener("contextmenu", onClickReceived);
        window.addEventListener("message", onMessageReceived);
        window.addEventListener("keydown", onKeyDownReceived);

        // onMessageReceived({ data: { ...debugPlayerInventory } } as MessageEvent);

        return () => {
            window.removeEventListener("contextmenu", onClickReceived);
            window.removeEventListener("message", onMessageReceived);
            window.removeEventListener("keydown", onKeyDownReceived);
        };
    }, [onClickReceived, onMessageReceived, onKeyDownReceived]);

    const inventoryRow = useMemo(() => {
        return useInventoryRow(playerInventory?.items || []);
    }, [playerInventory]);

    if (!playerInventory) {
        return null;
    }

    return (
        <DndContext
            autoScroll={{
                enabled: false,
            }}
            collisionDetection={rectIntersection}
            onDragEnd={handleDragAndDrop}
        >
            <div className={clsx(style.Wrapper, {
                [style.Show]: display,
                [style.Hide]: !display,
            })}>
                <ContainerWrapper
                    display={true}
                    banner={playerBanner}
                    weight={playerInventory.weight}
                    maxWeight={playerInventory.maxWeight}
                    sortCallback={() => handleSortInventory(playerInventory.id, setPlayerInventory)}
                >
                    <ContainerSlots
                        id="player"
                        rows={inventoryRow}
                        money={playerMoney}
                        items={playerInventory.items.map((item, i) => ({...item, id: i, shortcut: itemShortcut(item)}))}
                        action={interactAction}
                    />
                </ContainerWrapper>
            </div>
        </DndContext>
    )
}
